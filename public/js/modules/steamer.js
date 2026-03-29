import { UI } from '../ui/controller.js';

export const Steamer = {
    app: null,
    particles: [],
    PARTICLE_COUNT: 25,

    init(appInstance) {
        this.app = appInstance;
        this.createParticles();
    },

    createParticles() {
        const particleGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.2 
        });

        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
            this.resetParticle(particle);
            
            // 重要：随机化初始状态以打破“整齐重置”导致的闪烁/脉冲感
            particle.position.y += Math.random() * 12.0; // 随机垂直分布
            particle.material.opacity = Math.random() * 0.15; // 随机初始透明度
            
            particle.visible = true;
            this.app.scene.add(particle);
            this.particles.push(particle);
        }
    },

    resetParticle(particle) {
        // Ensure velocity exists to prevent crashes
        if (!particle.userData.velocity) {
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.05,
                0.05,
                (Math.random() - 0.5) * 0.05
            );
        }

        if (!this.app || !this.app.layers || this.app.layers.length === 0) {
            particle.visible = false;
            return;
        }
        
        particle.visible = true;
        const layer = this.app.layers[Math.floor(Math.random() * this.app.layers.length)];
        if (!layer || !layer.mesh) return;
        
        const targetLayer = layer.mesh;
        const modelScale = targetLayer.scale ? targetLayer.scale.y : 1.0;
        const modelHeight = 4.0 * modelScale; // 模型高度（球体和外部模型均已统一为 4 单位）
        const dispersion = modelScale * 2.0;   // 水平发散范围
        
        particle.position.x = (targetLayer.position ? targetLayer.position.x : 0) + (Math.random() - 0.5) * dispersion;
        particle.position.y = (targetLayer.position ? targetLayer.position.y : 0) + modelHeight + (Math.random() * 0.8);
        particle.position.z = (targetLayer.position ? targetLayer.position.z : 0) + (Math.random() - 0.5) * dispersion;
        
        const baseOpacity = this.app.isSteaming ? 0.3 : 0.15;
        const baseSpeed = this.app.isSteaming ? 0.05 : 0.015;
        
        particle.scale.setScalar(Math.random() * 1.5 + 0.5);
        particle.material.opacity = baseOpacity;
        
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.05,
            Math.random() * baseSpeed + 0.02,
            (Math.random() - 0.5) * 0.05
        );
    },

    update() {
        if (!this.particles) return;
        this.particles.forEach(p => {
            if (!p.userData || !p.userData.velocity) return;
            p.position.add(p.userData.velocity);
            const decay = this.app.isSteaming ? 0.001 : 0.0008;
            const growth = this.app.isSteaming ? 0.002 : 0.001;
            
            p.material.opacity -= decay;
            p.scale.addScalar(growth);
            
            if (p.material.opacity <= 0) this.resetParticle(p);
        });
    },

    start() {
        UI.toggleSteamLabel(true);
        this.particles.forEach(p => {
            p.userData.velocity.y += 0.1;
            p.material.opacity = 0.6;
        });

        setTimeout(() => {
            this.app.isSteaming = false;
            UI.toggleSteamLabel(false);
            UI.showGameOver();
            
            // Clean up particles
            this.particles.forEach(p => {
                p.visible = false;
            });
        }, 5000);
    }
};
