import { UI } from '../ui/controller.js';

export const Master = {
    modelName: window.ENV_CONFIG?.GEMINI_MODEL || "gemini-3.1-flash-lite-preview",

    async init() {
        // Prefer window.ENV_CONFIG injected by middleware to avoid extra network request
        if (window.ENV_CONFIG?.GEMINI_MODEL) {
            this.modelName = window.ENV_CONFIG.GEMINI_MODEL;
            return;
        }
        
        if (this.modelName && this.modelName !== "gemini-3.1-flash-lite-preview") return;
        
        try {
            const resp = await fetch('/api/config');
            const config = await resp.json();
            if (config.GEMINI_MODEL) {
                this.modelName = config.GEMINI_MODEL;
            }
        } catch (e) {
            console.warn("Using default model due to config load failure:", e);
        }
    },

    async askMaster() {
        const assistantContainer = document.getElementById('assistant-container');
        if (assistantContainer && assistantContainer.classList.contains('is-thinking')) return;
        
        UI.setThinking(true);
        UI.updateSpeech("让我看看师傅的手艺...");

        try {
            await this.init();
            const { scene, camera, renderer } = window.App;
            renderer.render(scene, camera);
            
            // 使用高质量 PNG
            const screenshot = renderer.domElement.toDataURL('image/png').split(',')[1];
            
            const response = await fetch(`/api/ask-master`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: this.modelName,
                    contents: [{
                        parts: [
                            { text: "我是胶东花饽饽学徒，这是我的作品截图。请以大师身份给我一句关于花饽饽食材配色与寓意的简短指导，50字以内。" },
                            { inlineData: { mimeType: "image/png", data: screenshot } }
                        ]
                    }],
                    systemInstruction: { parts: [{ text: "你是一位精通胶东花饽饽配色和食材寓意的非遗大师。" }] }
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                UI.updateSpeech("师傅正忙，请稍后再试");
                return;
            }

            const advice = data.candidates?.[0]?.content?.parts?.[0]?.text || "配色考究，面相饱满。";
            UI.updateSpeech(advice);
        } catch (e) {
            console.error("Master Error:", e);
            UI.updateSpeech("信号有些弱，再试试？");
        } finally {
            UI.setThinking(false);
        }
    }
};
