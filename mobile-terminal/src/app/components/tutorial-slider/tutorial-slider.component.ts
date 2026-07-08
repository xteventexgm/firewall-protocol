import { Component, EventEmitter, Output, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-tutorial-slider',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './tutorial-slider.component.html',
  styleUrls: ['./tutorial-slider.component.scss']
})
export class TutorialSliderComponent implements AfterViewInit {
  @Output() dismissed = new EventEmitter<void>();
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLElement>;

  slides = [
    { id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }
  ];
  
  currentSlide = 0;

  ngAfterViewInit(): void {
    const container = this.scrollContainer.nativeElement;
    container.addEventListener('scroll', () => {
      const scrollLeft = container.scrollLeft;
      const width = container.clientWidth;
      this.currentSlide = Math.round(scrollLeft / width);
    });
  }

  nextSlide(): void {
    if (this.currentSlide < this.slides.length - 1) {
      this.currentSlide++;
      this.scrollToCurrent();
    } else {
      this.finish();
    }
  }
  
  prevSlide(): void {
    if (this.currentSlide > 0) {
      this.currentSlide--;
      this.scrollToCurrent();
    }
  }

  private scrollToCurrent(): void {
    const container = this.scrollContainer.nativeElement;
    container.scrollTo({
      left: this.currentSlide * container.clientWidth,
      behavior: 'smooth'
    });
  }

  finish(): void {
    localStorage.setItem('has_seen_tutorial', 'true');
    this.dismissed.emit();
  }
}
