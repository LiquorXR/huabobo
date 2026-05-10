import { UI } from '../ui/controller.js?v=1.1.0';

const SYSTEM_PROMPT = "你是一位精通胶东花饽饽配色和食材寓意的非遗大师。";
const USER_PROMPT = "我是胶东花饽饽学徒，这是我的作品截图。请以大师身份给我一句关于花饽饽食材配色与寓意的简短指导，100字以内。";
const FALLBACK_TEXT = "配色考究，面相饱满。";

export const Master = {
    modelName: window.ENV_CONFIG?.OPENAI_MODEL || "gpt-4o-mini",
    enableThinking: window.ENV_CONFIG?.OPENAI_ENABLE_THINKING || false,

    async init() {
        if (window.ENV_CONFIG?.OPENAI_MODEL) {
            this.modelName = window.ENV_CONFIG.OPENAI_MODEL;
            this.enableThinking = window.ENV_CONFIG.OPENAI_ENABLE_THINKING || false;
            return;
        }

        if (this.modelName && this.modelName !== "gpt-4o-mini") return;

        try {
            const resp = await fetch('/api/config');
            const config = await resp.json();
            if (config.OPENAI_MODEL) {
                this.modelName = config.OPENAI_MODEL;
                this.enableThinking = config.OPENAI_ENABLE_THINKING || false;
            }
        } catch (e) {
            console.warn("Using default model due to config load failure:", e);
        }
    },

    async askMaster() {
        const assistantContainer = document.getElementById('assistant-container');
        if (assistantContainer && assistantContainer.classList.contains('is-thinking')) return;

        UI.setThinking(true);

        try {
            await this.init();
            const { scene, camera, renderer } = window.App;
            renderer.render(scene, camera);

            const screenshot = renderer.domElement.toDataURL('image/png');

            const headers = { "Content-Type": "application/json" };
            const token = localStorage.getItem('huabobo_token');
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch('/api/ask-master', {
                method: "POST",
                headers,
                body: JSON.stringify({
                    model: this.modelName,
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: [
                            { type: "text", text: USER_PROMPT },
                            { type: "image_url", image_url: { url: screenshot } }
                        ]}
                    ],
                    stream: true,
                    enableThinking: this.enableThinking
                })
            });

            if (!response.ok) {
                const data = await response.json();
                UI.updateSpeech(data.error?.message || "师傅正忙，请稍后再试");
                return;
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/event-stream')) {
                await this._handleStream(response);
            } else {
                const data = await response.json();
                if (data.error) {
                    UI.updateSpeech("师傅正忙，请稍后再试");
                    return;
                }
                const content = data.choices?.[0]?.message?.content || FALLBACK_TEXT;
                UI.updateSpeech(content);
            }

        } catch (e) {
            console.error("Master Error:", e);
            UI.updateSpeech("信号有些弱，再试试？");
        } finally {
            UI.setThinking(false);
        }
    },

    async _handleStream(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';
        let startedContent = false;
        let reasoningActive = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data: ')) continue;

                const data = trimmed.slice(6).trim();
                if (data === '[DONE]') continue;

                try {
                    const json = JSON.parse(data);
                    if (json.error) {
                        UI.updateSpeech("师傅正忙，请稍后再试");
                        return;
                    }

                    const delta = json.choices?.[0]?.delta;
                    if (delta?.reasoning_content && !reasoningActive) {
                        reasoningActive = true;
                        UI.showReasoningProgress();
                    }
                    if (delta?.content) {
                        if (!startedContent) {
                            startedContent = true;
                            UI.streamingStart();
                        }
                        fullContent += delta.content;
                        UI.appendStreamText(delta.content);
                    }
                } catch (e) {
                    // skip unparseable lines
                }
            }
        }

        if (!fullContent) {
            UI.updateSpeech(FALLBACK_TEXT);
        }
    }
};
