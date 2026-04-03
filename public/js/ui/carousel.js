export const Carousel = {
    currentIndex: 0,
    totalSlides: 0,
    container: null,
    indicators: [],
    timer: null,
    interval: 5000,

    init() {
        this.container = document.getElementById('carousel-slides');
        if (!this.container) return;

        // 自动识别幻灯片数量
        this.totalSlides = this.container.children.length;
        
        // 自动生成导航小圆点
        const indicatorContainer = document.getElementById('carousel-indicators');
        if (indicatorContainer) {
            indicatorContainer.innerHTML = ''; // 清空原有内容
            this.indicators = [];
            for (let i = 0; i < this.totalSlides; i++) {
                const dot = document.createElement('div');
                dot.className = 'w-1.5 h-1.5 rounded-full bg-white/40 transition-all cursor-pointer';
                if (i === 0) dot.classList.add('active-dot');
                dot.onclick = () => this.goTo(i); // 支持点击跳转
                indicatorContainer.appendChild(dot);
                this.indicators.push(dot);
            }
        }

        this.startAutoPlay();
        
        // Pause on hover
        const mainContainer = document.getElementById('image-carousel');
        if (mainContainer) {
            mainContainer.addEventListener('mouseenter', () => this.stopAutoPlay());
            mainContainer.addEventListener('mouseleave', () => this.startAutoPlay());
        }

        this.setupTouchGestures();
    },

    setupTouchGestures() {
        if (!this.container) return;

        let touchStartX = 0;
        let touchEndX = 0;

        this.container.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            this.stopAutoPlay(); // Stop auto-play when user interacts
        }, { passive: true });

        this.container.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleGesture(touchStartX, touchEndX);
            this.startAutoPlay(); // Resume auto-play after interaction
        }, { passive: true });
    },

    handleGesture(startX, endX) {
        const threshold = 50; 
        if (endX < startX - threshold) {
            this.next();
        } else if (endX > startX + threshold) {
            this.prev();
        }
    },

    next() {
        this.currentIndex = (this.currentIndex + 1) % this.totalSlides;
        this.updateUI();
    },

    prev() {
        this.currentIndex = (this.currentIndex - 1 + this.totalSlides) % this.totalSlides;
        this.updateUI();
    },

    goTo(index) {
        this.currentIndex = index;
        this.updateUI();
    },

    updateUI() {
        if (this.container) {
            this.container.style.transform = `translateX(-${this.currentIndex * 100}%)`;
        }

        this.indicators.forEach((dot, i) => {
            if (i === this.currentIndex) {
                dot.classList.add('active-dot');
            } else {
                dot.classList.remove('active-dot');
            }
        });
    },

    startAutoPlay() {
        this.stopAutoPlay();
        this.timer = setInterval(() => this.next(), this.interval);
    },

    stopAutoPlay() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
};
