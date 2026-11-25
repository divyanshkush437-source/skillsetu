import test from "node:test";
import assert from "node:assert/strict";
import { speechInput, synthesizeSpeech } from "../backend/speech-core.mjs";

test("Speech accepts listed languages and rejects oversized requests", () => {
  assert.deepEqual(speechInput({ language: "sat", text: "ᱡᱚᱦᱟᱨ" }), { language: "sat", text: "ᱡᱚᱦᱟᱨ" });
  assert.throws(() => speechInput({ language: "xx", text: "hello" }), /listed language/);
  assert.throws(() => speechInput({ language: "hi", text: "a".repeat(301) }), /short phrase/);
});

test("Speech resolves a matching model and returns WAV from the provider", async () => {
  const requests = [];
  const fetcher = async (url, request) => {
    requests.push({ url, body: JSON.parse(request.body), headers: request.headers });
    return {
      ok: true,
      json: async () => requests.length === 1 ? {
        pipelineResponseConfig: [{ taskType: "tts", config: [{ language: { sourceLanguage: "sat" }, serviceId: "model/sat" }] }],
        pipelineInferenceAPIEndPoint: { callbackUrl: "https://dhruva-api.bhashini.gov.in/services/inference/pipeline", inferenceApiKey: { value: "inference-key" } },
      } : { pipelineResponse: [{ audio: [{ audioContent: "UklGRg==" }] }] },
    };
  };
  const result = await synthesizeSpeech({ language: "sat", text: "ᱡᱚᱦᱟᱨ" }, { userId: "account", ulcaApiKey: "secret" }, fetcher);
  assert.deepEqual(result, { audio: "UklGRg==", mimeType: "audio/wav" });
  assert.equal(requests[1].body.pipelineTasks[0].config.serviceId, "model/sat");
  assert.equal(requests[1].body.inputData.input[0].source, "ᱡᱚᱦᱟᱨ");
  assert.equal(requests[1].headers.Authorization, "inference-key");
});

test("Speech checks another pipeline when the first has no model for the selected language", async () => {
  const requests = [];
  const fetcher = async (url, request) => {
    requests.push({ url, body: JSON.parse(request.body) });
    return {
      ok: true,
      json: async () => requests.length === 1
        ? { pipelineResponseConfig: [{ taskType: "tts", config: [] }] }
        : requests.length === 2
          ? {
              pipelineResponseConfig: [{ taskType: "tts", config: [{ language: { sourceLanguage: "doi" }, serviceId: "model/doi" }] }],
              pipelineInferenceAPIEndPoint: { callbackUrl: "https://dhruva-api.bhashini.gov.in/services/inference/pipeline", inferenceApiKey: { value: "key" } },
            }
          : { pipelineResponse: [{ audio: [{ audioContent: "UklGRg==" }] }] },
    };
  };
  const result = await synthesizeSpeech({ language: "doi", text: "डोगरी" }, { userId: "account", ulcaApiKey: "secret" }, fetcher);
  assert.equal(result.mimeType, "audio/wav");
  assert.equal(requests.length, 3);
  assert.notEqual(requests[0].body.pipelineRequestConfig.pipelineId, requests[1].body.pipelineRequestConfig.pipelineId);
});
