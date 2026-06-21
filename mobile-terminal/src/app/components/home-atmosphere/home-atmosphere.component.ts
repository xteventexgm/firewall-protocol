import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
} from '@angular/core';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

@Component({
  selector: 'app-home-atmosphere',
  standalone: true,
  template: `
    <div class="home-atmosphere" aria-hidden="true">
      <div class="home-grid"></div>
      <canvas #canvas class="home-particles"></canvas>
    </div>
  `,
  styleUrl: './home-atmosphere.component.scss',
})
export class HomeAtmosphereComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private frame?: number;
  private particles: Particle[] = [];
  private width = 0;
  private height = 0;

  ngAfterViewInit(): void {
    this.initParticles();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvas();
  }

  private initParticles(): void {
    this.resizeCanvas();
    const count = Math.max(48, Math.floor((this.width * this.height) / 14_000));
    this.particles = Array.from({ length: count }, () => this.spawnParticle());
  }

  private spawnParticle(): Particle {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      size: 0.8 + Math.random() * 2.2,
      alpha: 0.12 + Math.random() * 0.38,
    };
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    canvas.width = this.width;
    canvas.height = this.height;
  }

  private animate(): void {
    const canvas = this.canvasRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, this.width, this.height);

      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -8) p.x = this.width + 8;
        if (p.x > this.width + 8) p.x = -8;
        if (p.y < -8) p.y = this.height + 8;
        if (p.y > this.height + 8) p.y = -8;

        for (const q of this.particles) {
          if (p === q) continue;
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.04 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha * 0.15})`;
        ctx.fill();
      }

      this.frame = requestAnimationFrame(draw);
    };

    draw();
  }
}
