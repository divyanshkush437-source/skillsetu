// BHASHINI resolves the TTS model for each language before synthesis.
const configEndpoint = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";
const defaultPipelines = ["660fa5bec7fb5b0328229016", "64392f96daac500b55c543cd"];
const allowedCodes = new Set("en as bn brx doi gu hi kn ks kok mai ml mni mr ne or pa sa sat sd ta te ur".split(" "));
const cache = new Map();

export function speechInput(body) {
  if (!allowedCodes.has(body?.language)) throw Object.assign(Error("Choose a listed language."), { status: 400 });
  const text = body.text;
  if (typeof text !== "string" || text.length < 1 || text.length > 300 || /[\u0000-\u001f]/.test(text)) {
    throw Object.assign(Error("Choose a short phrase to read aloud."), { status: 400 });
  }
  return { language: body.language, text };
}

export async function synthesizeSpeech({ language, text }, credentials, fetcher = fetch) {
  const pipelineIds = credentials.pipelineId ? [credentials.pipelineId] : defaultPipelines;
  if (!credentials.userId || !credentials.ulcaApiKey) throw Error("Speech service is not configured.");
  const cached = cache.get(language);
  let settings = cached?.expires > Date.now() ? cached : null;
  if (!settings) {
    for (const pipelineId of pipelineIds) {
      const response = await fetcher(configEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", userId: credentials.userId, ulcaApiKey: credentials.ulcaApiKey },
        body: JSON.stringify({ pipelineTasks: [{ taskType: "tts", config: { language: { sourceLanguage: language } } }], pipelineRequestConfig: { pipelineId } }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 400 || response.status === 422) continue;
      if (!response.ok) throw Error("Speech model lookup failed.");
      const config = await response.json();
      const models = config.pipelineResponseConfig?.find(item => item.taskType === "tts")?.config || [];
      const service = models.find(item => item.language?.sourceLanguage === language);
      if (!service?.serviceId) continue;
      const api = config.pipelineInferenceAPIEndPoint;
      const callback = api?.callbackUrl && new URL(api.callbackUrl);
      if (!api?.inferenceApiKey?.value || callback?.protocol !== "https:" || callback.hostname !== "dhruva-api.bhashini.gov.in") {
        throw Error("Speech model configuration is invalid.");
      }
      settings = { serviceId: service.serviceId, url: api.callbackUrl, key: api.inferenceApiKey.value, expires: Date.now() + 3600000 };
      cache.set(language, settings);
      break;
    }
    if (!settings) throw Object.assign(Error("Speech is unavailable for this language."), { status: 503 });
  }
  const response = await fetcher(settings.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: settings.key },
    body: JSON.stringify({ pipelineTasks: [{ taskType: "tts", config: { language: { sourceLanguage: language }, serviceId: settings.serviceId, gender: "female", speed: 0.9 } }], inputData: { input: [{ source: text }] } }),
    signal: AbortSignal.timeout(14000),
  });
  if (!response.ok) throw Error("Speech generation failed.");
  const result = await response.json();
  const audio = result.pipelineResponse?.[0]?.audio?.[0];
  if (!audio?.audioContent || audio.audioContent.length > 1500000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio.audioContent)) throw Error("Speech service returned invalid audio.");
  return { audio: audio.audioContent, mimeType: "audio/wav" };
}
