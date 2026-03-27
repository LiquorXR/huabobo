import { UI } from '../ui/controller.js';

export const Steamer = {
    app: null,
    particles: [],
    PARTICLE_COUNT: 150,

    init(appInstance) {
        this.app = appInstance;
        this.createParticles();
    },

    createParticles() {
        const particleGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.2 
        });

        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
            this.resetParticle(particle);
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
        const scale = targetLayer.scale ? targetLayer.scale.x * 2 : 2;
        
        particle.position.x = (targetLayer.position ? targetLayer.position.x : 0) + (Math.random() - 0.5) * scale;
        particle.position.y = (targetLayer.position ? targetLayer.position.y : 0) + (Math.random() * 0.5);
        particle.position.z = (targetLayer.position ? targetLayer.position.z : 0) + (Math.random() - 0.5) * scale;
        
        const baseOpacity = this.app.isSteaming ? 0.6 : 0.25;
        const baseSpeed = this.app.isSteaming ? 0.15 : 0.05;
        
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
            const decay = this.app.isSteaming ? 0.005 : 0.01;
            const growth = this.app.isSteaming ? 0.03 : 0.01;
            
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
