document.addEventListener('alpine:init', function() {
    Alpine.data('counter', function() {
        return {
            description: 'Minimal demo component: increment, decrement, reset a number',

            count: 0,
            step: 1,
            inc() { this.count += this.step },
            dec() { this.count -= this.step },
            reset() { this.count = 0 }
        }
    })
})
