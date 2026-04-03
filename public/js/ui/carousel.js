export const Carousel = {
    currentIndex: 0,
    totalSlides: 5,
    container: null,
    indicators: [],
    timer: null,
    interval: 5000,

    init() {
        this.container = document.getElementById('carousel-slides');
        const indicatorContainer = document.getElementById('carousel-indicators');
        if (indicatorContainer) {
            this.indicators = Array.from(indicatorContainer.children);
        }

        if (!this.container) return;

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
