// Devil mascot for the Claude Code mod. Lives in the floating toolbar next to
// "Send to Claude" and acts out where the page's annotations are: nothing to do,
// new ones waiting, sent and in progress, waiting on the user (variant pick), done.
// Ported from the devil-mascot rig (same parts, pivots, expressions and actions),
// trimmed to what the toolbar needs. Inline SVG + one rAF loop, no dependencies.
// prefers-reduced-motion: static pose per state, no loop.

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 0 780 812" aria-hidden="true" focusable="false"><defs>  <linearGradient id="vm-g-hood" x1="0" y1="152" x2="0" y2="508" gradientUnits="userSpaceOnUse">    <stop offset="0" stop-color="#FF9B00"/><stop offset=".22" stop-color="#FF5A3A"/>    <stop offset=".5" stop-color="#FF2DAD"/><stop offset=".72" stop-color="#9A20A6"/>    <stop offset=".93" stop-color="#2A1450"/></linearGradient>  <radialGradient id="vm-g-hood-shade" cx="400" cy="300" r="250" gradientUnits="userSpaceOnUse">    <stop offset=".72" stop-color="#1B0C36" stop-opacity="0"/><stop offset="1" stop-color="#1B0C36" stop-opacity=".45"/></radialGradient>  <linearGradient id="vm-g-rim" x1="0" y1="206" x2="0" y2="492" gradientUnits="userSpaceOnUse">    <stop offset="0" stop-color="#3B1868"/><stop offset="1" stop-color="#2A1450"/></linearGradient>  <radialGradient id="vm-g-visor" cx="400" cy="330" r="200" gradientUnits="userSpaceOnUse">    <stop offset=".6" stop-color="#120B22"/><stop offset="1" stop-color="#1E1238"/></radialGradient>  <linearGradient id="vm-g-horn" x1="0" y1="24" x2="0" y2="236" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFA91A"/><stop offset=".45" stop-color="#FF6A2E"/><stop offset=".8" stop-color="#FF3A6E"/><stop offset="1" stop-color="#FF2DAD"/></linearGradient>  <linearGradient id="vm-g-torso" x1="278" y1="0" x2="522" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#241046"/><stop offset=".16" stop-color="#2A1450"/><stop offset=".5" stop-color="#321860"/><stop offset=".84" stop-color="#2A1450"/><stop offset="1" stop-color="#241046"/></linearGradient>  <linearGradient id="vm-g-limb" x1="0" y1="-30" x2="0" y2="150" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2A1450"/><stop offset="1" stop-color="#2E1659"/></linearGradient>  <linearGradient id="vm-g-leg" x1="0" y1="650" x2="0" y2="780" gradientUnits="userSpaceOnUse">    <stop offset="0" stop-color="#1B0C36"/><stop offset=".35" stop-color="#2A1450"/><stop offset="1" stop-color="#25113F"/></linearGradient>  <linearGradient id="vm-g-wing" x1="0" y1="470" x2="0" y2="620" gradientUnits="userSpaceOnUse">    <stop offset="0" stop-color="#3A0F6B"/><stop offset=".55" stop-color="#22103F"/><stop offset="1" stop-color="#1B0C36"/></linearGradient>  <linearGradient id="vm-g-tail" x1="505" y1="690" x2="760" y2="420" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3E1478"/><stop offset=".28" stop-color="#9A1BA6"/><stop offset=".5" stop-color="#FF2DAD"/><stop offset=".72" stop-color="#FF4E4A"/><stop offset="1" stop-color="#FFA91A"/></linearGradient><clipPath id="vm-clip-tail-body"><rect x="0" y="562" width="900" height="400"/></clipPath><clipPath id="vm-clip-tail-tip"><rect x="600" y="300" width="300" height="272"/></clipPath>  <clipPath id="vm-clip-angry-l"><path d="M 290 316 L 382 354 L 382 440 L 290 440 Z"/></clipPath>  <clipPath id="vm-clip-angry-r"><path d="M 510 316 L 418 354 L 418 440 L 510 440 Z"/></clipPath>  <clipPath id="vm-clip-sleepy"><rect x="250" y="364" width="300" height="80"/></clipPath></defs><ellipse id="vm-shadow" cx="400" cy="784" rx="150" ry="16" fill="#1B0C36" opacity=".16" style="transform-origin:400px 784px"/><g id="vm-mascot" style="transform-origin:400px 780px"><g id="vm-leg-l" style="transform-origin:330px 660px"><path d="M 290 650 L 280 750 C 278 770 290 780 312 780 L 352 780 C 370 780 376 772 374 756 L 370 650 Z" fill="url(#vm-g-leg)"/></g><g id="vm-leg-r" style="transform-origin:470px 660px"><path d="M 510 650 L 520 750 C 522 770 510 780 488 780 L 448 780 C 430 780 424 772 426 756 L 430 650 Z" fill="url(#vm-g-leg)"/></g><g id="vm-upper-body" style="transform-origin:400px 700px"><g id="vm-tail" style="transform-origin:500px 652px"><path d="M 736 410 C 733 411 731 412 730 414 C 728 416 727 418 726 420 C 724 422 723 424 722 426 C 721 428 720 430 719 432 C 718 434 717 437 716 439 C 715 441 714 443 713 445 C 712 447 712 450 711 452 C 710 454 709 456 708 458 C 707 460 706 462 705 465 C 704 467 703 469 702 471 C 702 473 701 475 700 478 C 699 480 698 482 697 484 C 696 486 696 488 695 491 C 694 493 693 495 692 497 C 692 500 691 502 690 504 C 690 506 689 509 688 511 C 688 513 687 515 687 518 C 686 520 686 522 686 525 C 687 527 688 530 689 531 C 691 532 694 533 696 534 C 698 534 700 533 703 533 C 705 532 707 531 709 530 C 711 529 713 528 716 527 C 718 526 720 524 722 524 C 724 524 726 526 726 528 C 727 530 726 533 726 535 C 726 538 725 540 725 542 C 725 545 724 547 724 549 C 724 552 723 554 723 556 C 722 558 722 561 721 563 C 721 565 720 568 719 570 C 719 572 718 574 717 576 C 716 579 715 581 714 583 C 713 585 712 587 712 589 C 710 592 709 594 708 596 C 707 598 706 600 705 602 C 704 604 702 606 701 608 C 700 610 698 612 697 614 C 696 616 694 617 693 619 C 691 621 690 623 688 624 C 687 626 685 628 683 630 C 682 631 680 633 678 634 C 676 636 675 637 673 639 C 671 640 669 642 667 643 C 665 644 663 645 661 646 C 659 647 657 648 654 649 C 652 650 650 651 648 652 C 646 653 644 654 641 655 C 639 655 637 656 635 657 C 632 657 630 658 628 658 C 626 659 623 660 621 660 C 619 660 616 661 614 661 C 612 661 609 662 607 662 C 605 662 602 662 600 662 C 598 662 595 662 593 662 C 591 662 588 662 586 662 C 584 662 581 662 579 662 C 577 662 574 661 572 661 C 570 661 567 660 565 660 C 563 659 560 659 558 658 C 556 658 554 657 551 656 C 549 656 547 655 545 654 C 543 653 541 651 539 650 C 537 649 535 647 533 646 C 532 644 530 643 528 641 C 526 640 524 638 523 636 C 521 635 519 633 518 632 C 516 630 514 629 512 627 C 510 626 508 625 505 625 C 503 624 501 624 498 624 C 496 624 494 625 492 626 C 489 627 487 628 485 629 C 484 631 482 632 481 634 C 479 636 478 638 477 640 C 477 643 476 645 476 647 C 476 650 476 652 477 654 C 478 657 479 659 480 661 C 481 663 483 664 484 666 C 486 668 488 669 490 671 C 492 672 494 674 495 675 C 497 677 499 678 501 680 C 503 681 504 682 506 684 C 508 685 510 687 512 688 C 514 689 516 690 518 692 C 520 693 522 694 524 695 C 526 696 529 697 531 698 C 533 698 535 699 538 700 C 540 700 542 701 544 701 C 547 702 549 703 551 703 C 554 704 556 704 558 704 C 560 705 563 705 565 705 C 568 705 570 706 572 706 C 574 706 577 706 579 706 C 582 706 584 706 586 706 C 589 706 591 706 593 706 C 596 706 598 706 600 705 C 603 705 605 705 607 705 C 610 705 612 705 614 704 C 617 704 619 704 621 703 C 624 703 626 703 628 702 C 630 702 633 701 635 701 C 637 700 640 699 642 699 C 644 698 646 697 649 697 C 651 696 653 695 655 694 C 657 694 660 693 662 692 C 664 691 666 690 668 689 C 670 688 672 687 674 686 C 677 685 679 684 681 682 C 683 681 685 680 687 679 C 689 678 691 676 693 675 C 694 674 696 672 698 671 C 700 669 702 668 704 666 C 705 664 707 663 709 661 C 710 660 712 658 714 656 C 715 654 717 653 718 651 C 720 649 721 647 723 646 C 724 644 726 642 727 640 C 728 638 730 636 731 634 C 732 632 734 630 735 628 C 736 626 737 624 738 622 C 740 620 741 618 742 616 C 743 614 744 612 745 610 C 746 608 747 605 748 603 C 749 601 750 599 750 597 C 751 595 752 592 753 590 C 754 588 754 586 755 584 C 756 581 756 579 757 577 C 758 574 758 572 758 570 C 759 568 759 565 760 563 C 760 561 761 558 762 556 C 762 554 763 552 763 549 C 764 547 764 545 764 542 C 764 540 764 538 764 535 C 765 533 765 530 765 528 C 765 526 765 523 766 521 C 767 520 770 520 772 520 C 774 520 776 521 778 522 C 781 523 783 523 785 524 C 788 525 790 525 792 525 C 794 525 797 525 799 524 C 801 523 803 521 803 519 C 804 517 804 514 804 512 C 804 510 803 507 802 505 C 801 503 800 501 800 499 C 799 496 798 494 797 492 C 796 490 795 488 794 486 C 793 484 792 482 790 480 C 790 478 788 475 787 473 C 786 471 785 469 784 467 C 783 465 782 463 780 461 C 779 459 778 457 777 455 C 776 453 774 451 773 449 C 772 447 770 445 769 443 C 768 441 766 439 765 437 C 764 436 763 434 761 432 C 760 430 759 428 757 426 C 756 424 754 422 753 420 C 752 418 750 416 748 415 C 746 414 744 412 742 411 C 740 410 738 410 736 410 Z" fill="url(#vm-g-tail)" clip-path="url(#vm-clip-tail-body)"/><g id="vm-tail-tip" style="transform-origin:742px 566px"><path d="M 736 410 C 733 411 731 412 730 414 C 728 416 727 418 726 420 C 724 422 723 424 722 426 C 721 428 720 430 719 432 C 718 434 717 437 716 439 C 715 441 714 443 713 445 C 712 447 712 450 711 452 C 710 454 709 456 708 458 C 707 460 706 462 705 465 C 704 467 703 469 702 471 C 702 473 701 475 700 478 C 699 480 698 482 697 484 C 696 486 696 488 695 491 C 694 493 693 495 692 497 C 692 500 691 502 690 504 C 690 506 689 509 688 511 C 688 513 687 515 687 518 C 686 520 686 522 686 525 C 687 527 688 530 689 531 C 691 532 694 533 696 534 C 698 534 700 533 703 533 C 705 532 707 531 709 530 C 711 529 713 528 716 527 C 718 526 720 524 722 524 C 724 524 726 526 726 528 C 727 530 726 533 726 535 C 726 538 725 540 725 542 C 725 545 724 547 724 549 C 724 552 723 554 723 556 C 722 558 722 561 721 563 C 721 565 720 568 719 570 C 719 572 718 574 717 576 C 716 579 715 581 714 583 C 713 585 712 587 712 589 C 710 592 709 594 708 596 C 707 598 706 600 705 602 C 704 604 702 606 701 608 C 700 610 698 612 697 614 C 696 616 694 617 693 619 C 691 621 690 623 688 624 C 687 626 685 628 683 630 C 682 631 680 633 678 634 C 676 636 675 637 673 639 C 671 640 669 642 667 643 C 665 644 663 645 661 646 C 659 647 657 648 654 649 C 652 650 650 651 648 652 C 646 653 644 654 641 655 C 639 655 637 656 635 657 C 632 657 630 658 628 658 C 626 659 623 660 621 660 C 619 660 616 661 614 661 C 612 661 609 662 607 662 C 605 662 602 662 600 662 C 598 662 595 662 593 662 C 591 662 588 662 586 662 C 584 662 581 662 579 662 C 577 662 574 661 572 661 C 570 661 567 660 565 660 C 563 659 560 659 558 658 C 556 658 554 657 551 656 C 549 656 547 655 545 654 C 543 653 541 651 539 650 C 537 649 535 647 533 646 C 532 644 530 643 528 641 C 526 640 524 638 523 636 C 521 635 519 633 518 632 C 516 630 514 629 512 627 C 510 626 508 625 505 625 C 503 624 501 624 498 624 C 496 624 494 625 492 626 C 489 627 487 628 485 629 C 484 631 482 632 481 634 C 479 636 478 638 477 640 C 477 643 476 645 476 647 C 476 650 476 652 477 654 C 478 657 479 659 480 661 C 481 663 483 664 484 666 C 486 668 488 669 490 671 C 492 672 494 674 495 675 C 497 677 499 678 501 680 C 503 681 504 682 506 684 C 508 685 510 687 512 688 C 514 689 516 690 518 692 C 520 693 522 694 524 695 C 526 696 529 697 531 698 C 533 698 535 699 538 700 C 540 700 542 701 544 701 C 547 702 549 703 551 703 C 554 704 556 704 558 704 C 560 705 563 705 565 705 C 568 705 570 706 572 706 C 574 706 577 706 579 706 C 582 706 584 706 586 706 C 589 706 591 706 593 706 C 596 706 598 706 600 705 C 603 705 605 705 607 705 C 610 705 612 705 614 704 C 617 704 619 704 621 703 C 624 703 626 703 628 702 C 630 702 633 701 635 701 C 637 700 640 699 642 699 C 644 698 646 697 649 697 C 651 696 653 695 655 694 C 657 694 660 693 662 692 C 664 691 666 690 668 689 C 670 688 672 687 674 686 C 677 685 679 684 681 682 C 683 681 685 680 687 679 C 689 678 691 676 693 675 C 694 674 696 672 698 671 C 700 669 702 668 704 666 C 705 664 707 663 709 661 C 710 660 712 658 714 656 C 715 654 717 653 718 651 C 720 649 721 647 723 646 C 724 644 726 642 727 640 C 728 638 730 636 731 634 C 732 632 734 630 735 628 C 736 626 737 624 738 622 C 740 620 741 618 742 616 C 743 614 744 612 745 610 C 746 608 747 605 748 603 C 749 601 750 599 750 597 C 751 595 752 592 753 590 C 754 588 754 586 755 584 C 756 581 756 579 757 577 C 758 574 758 572 758 570 C 759 568 759 565 760 563 C 760 561 761 558 762 556 C 762 554 763 552 763 549 C 764 547 764 545 764 542 C 764 540 764 538 764 535 C 765 533 765 530 765 528 C 765 526 765 523 766 521 C 767 520 770 520 772 520 C 774 520 776 521 778 522 C 781 523 783 523 785 524 C 788 525 790 525 792 525 C 794 525 797 525 799 524 C 801 523 803 521 803 519 C 804 517 804 514 804 512 C 804 510 803 507 802 505 C 801 503 800 501 800 499 C 799 496 798 494 797 492 C 796 490 795 488 794 486 C 793 484 792 482 790 480 C 790 478 788 475 787 473 C 786 471 785 469 784 467 C 783 465 782 463 780 461 C 779 459 778 457 777 455 C 776 453 774 451 773 449 C 772 447 770 445 769 443 C 768 441 766 439 765 437 C 764 436 763 434 761 432 C 760 430 759 428 757 426 C 756 424 754 422 753 420 C 752 418 750 416 748 415 C 746 414 744 412 742 411 C 740 410 738 410 736 410 Z" fill="url(#vm-g-tail)" clip-path="url(#vm-clip-tail-tip)"/></g></g><g id="vm-wing-l" style="transform-origin:298px 520px"><path d="M 300 506 C 270 484 240 474 214 478 C 172 486 128 524 92 566 C 112 560 130 564 142 574 C 152 582 158 592 162 602 C 176 588 192 584 208 588 C 222 592 232 600 240 610 C 254 598 270 592 290 592 Z" fill="url(#vm-g-wing)" stroke="#FF2DAD" stroke-width="3" stroke-linejoin="round" stroke-opacity=".8"/><path d="M 290 514 L 142 574 M 290 524 L 208 588 M 286 508 L 214 480" stroke="#1B0C36" stroke-width="5" stroke-linecap="round" opacity=".8"/></g><g id="vm-wing-r" style="transform-origin:502px 520px"><path d="M 500 506 C 530 484 560 474 586 478 C 628 486 672 524 708 566 C 688 560 670 564 658 574 C 648 582 642 592 638 602 C 624 588 608 584 592 588 C 578 592 568 600 560 610 C 546 598 530 592 510 592 Z" fill="url(#vm-g-wing)" stroke="#FF2DAD" stroke-width="3" stroke-linejoin="round" stroke-opacity=".8"/><path d="M 510 514 L 658 574 M 510 524 L 592 588 M 514 508 L 586 480" stroke="#1B0C36" stroke-width="5" stroke-linecap="round" opacity=".8"/></g><g id="vm-torso" style="transform-origin:400px 700px"><path d="M 300 486 C 276 520 272 600 278 656 C 284 692 326 702 400 702 C 474 702 516 692 522 656 C 528 600 524 520 500 486 C 476 448 324 448 300 486 Z" fill="url(#vm-g-torso)"/><path d="M 282 662 C 296 688 340 694 400 694 C 460 694 504 688 518 662" fill="none" stroke="#1B0C36" stroke-width="5" stroke-linecap="round" opacity=".7"/><path d="M 340 500 C 360 520 440 520 460 500" fill="none" stroke="#1B0C36" stroke-width="18" stroke-linecap="round" opacity=".6"/></g><g id="vm-arm-l" style="transform-origin:294px 512px"><g transform="translate(294 512) rotate(29)"><path d="M -35 -36 C -35 -56 35 -56 35 -36 L 37 94 C 46 104 44 140 4 150 C -36 154 -47 120 -37 100 Z" fill="#2A1450"/><path d="M 33 50 C 36 72 37 86 37 96" fill="none" stroke="#1B0C36" stroke-width="4" stroke-linecap="round" opacity=".45"/></g></g><g id="vm-arm-r" style="transform-origin:506px 512px"><g transform="translate(506 512) rotate(-29)"><path d="M 35 -36 C 35 -56 -35 -56 -35 -36 L -37 94 C -46 104 -44 140 -4 150 C 36 154 47 120 37 100 Z" fill="#2A1450"/><path d="M -33 50 C -36 72 -37 86 -37 96" fill="none" stroke="#1B0C36" stroke-width="4" stroke-linecap="round" opacity=".45"/></g></g><g id="vm-head" style="transform-origin:400px 500px"><g id="vm-horn-l" style="transform-origin:258px 205px"><path d="M 247 24 C 244 25 242 27 239 28 C 236 29 234 31 231 33 C 229 35 227 37 225 39 C 222 41 220 43 218 45 C 216 47 214 50 212 52 C 210 54 208 56 206 59 C 204 61 203 64 201 66 C 199 68 198 71 196 74 C 194 76 193 79 191 81 C 190 84 188 86 187 89 C 185 92 184 94 183 97 C 181 100 180 103 179 105 C 178 108 176 111 175 114 C 174 116 173 119 172 122 C 172 125 171 128 170 131 C 169 134 168 137 168 140 C 167 142 166 146 166 148 C 165 151 165 154 165 157 C 164 160 164 163 164 166 C 164 169 164 172 164 175 C 164 178 164 181 164 184 C 164 187 164 190 165 193 C 166 196 166 199 168 202 C 169 204 171 207 173 209 C 176 210 179 211 182 211 C 185 211 188 209 190 208 C 193 206 195 204 198 203 C 201 202 204 199 206 200 C 208 201 208 206 210 208 C 210 211 211 214 212 217 C 213 220 213 223 214 226 C 216 228 217 232 218 234 C 220 236 223 238 225 239 C 228 239 231 238 234 236 C 236 235 239 233 241 231 C 243 229 246 227 248 225 C 251 224 253 222 255 220 C 258 218 260 216 263 215 C 265 213 267 211 270 209 C 272 208 275 206 277 204 C 280 202 282 201 285 199 C 287 197 290 196 292 194 C 294 192 297 190 299 188 C 302 186 304 185 306 183 C 309 181 312 178 312 176 C 312 174 310 170 308 168 C 307 166 304 163 303 161 C 301 158 298 155 299 153 C 299 151 303 149 306 148 C 308 147 311 147 314 146 C 317 145 320 144 322 142 C 324 140 326 137 327 134 C 328 132 327 128 326 126 C 325 123 323 121 321 118 C 319 116 316 114 314 112 C 312 110 309 109 307 107 C 305 105 303 102 300 100 C 298 98 296 97 294 94 C 292 92 290 90 288 88 C 286 85 284 83 282 80 C 281 78 279 75 278 73 C 277 70 276 67 275 64 C 274 61 273 58 272 56 C 271 53 271 50 270 47 C 270 44 269 41 268 38 C 266 35 265 32 263 30 C 261 28 259 26 256 25 C 253 24 250 24 247 24 Z" fill="url(#vm-g-horn)"/></g><g id="vm-horn-r" style="transform-origin:542px 205px"><path d="M 544 25 C 541 26 539 28 537 30 C 535 32 534 35 532 38 C 531 41 530 44 530 47 C 529 50 529 53 528 56 C 527 58 526 61 525 64 C 524 67 523 70 522 73 C 521 75 519 78 518 80 C 516 83 514 85 512 88 C 510 90 508 92 506 94 C 504 97 502 98 500 100 C 497 102 495 105 493 107 C 491 109 488 110 486 112 C 484 114 481 116 479 118 C 477 121 475 123 474 126 C 473 128 472 132 473 134 C 474 137 476 140 478 142 C 480 144 483 145 486 146 C 489 147 492 147 494 148 C 497 149 501 151 501 153 C 502 155 499 158 497 161 C 496 163 493 166 492 168 C 490 170 488 174 488 176 C 488 178 491 181 494 183 C 496 185 498 186 501 188 C 503 190 506 192 508 194 C 510 196 513 197 515 199 C 518 201 520 202 523 204 C 525 206 528 208 530 209 C 533 211 535 213 537 215 C 540 216 542 218 545 220 C 547 222 549 224 552 225 C 554 227 557 229 559 231 C 561 233 564 235 566 236 C 569 238 572 239 575 239 C 577 238 580 236 582 234 C 583 232 584 228 586 226 C 587 223 587 220 588 217 C 589 214 590 211 590 208 C 592 206 592 201 594 200 C 596 199 599 202 602 203 C 605 204 607 206 610 208 C 612 209 615 211 618 211 C 621 211 624 210 627 209 C 629 207 631 204 632 202 C 634 199 634 196 635 193 C 636 190 636 187 636 184 C 636 181 636 178 636 175 C 636 172 636 169 636 166 C 636 163 636 160 635 157 C 635 154 635 151 634 148 C 634 146 633 142 632 140 C 632 137 631 134 630 131 C 629 128 628 125 628 122 C 627 119 626 116 625 114 C 624 111 622 108 621 105 C 620 103 619 100 617 97 C 616 94 615 92 613 89 C 612 86 610 84 609 81 C 607 79 606 76 604 74 C 602 71 601 68 599 66 C 597 64 596 61 594 59 C 592 56 590 54 588 52 C 586 50 584 47 582 45 C 580 43 578 41 575 39 C 573 37 571 35 569 33 C 566 31 564 29 561 28 C 558 27 556 25 553 24 C 550 24 547 24 544 25 Z" fill="url(#vm-g-horn)"/></g><g id="vm-hood" style="transform-origin:400px 330px"><path d="M 400 152 C 548 152 640 222 640 338 C 640 448 562 508 400 508 C 238 508 160 448 160 338 C 160 222 252 152 400 152 Z" fill="url(#vm-g-hood)"/><path d="M 400 152 C 548 152 640 222 640 338 C 640 448 562 508 400 508 C 238 508 160 448 160 338 C 160 222 252 152 400 152 Z" fill="url(#vm-g-hood-shade)"/><path d="M 400 206 C 520 206 600 254 600 348 C 600 440 530 492 400 492 C 270 492 200 440 200 348 C 200 254 280 206 400 206 Z" fill="url(#vm-g-rim)"/></g><g id="vm-visor" style="transform-origin:400px 354px"><path d="M 400 236 C 506 236 574 274 574 352 C 574 432 512 472 400 472 C 288 472 226 432 226 352 C 226 274 294 236 400 236 Z" fill="url(#vm-g-visor)"/><g id="vm-face" style="transform-origin:400px 390px"><g id="vm-eyes" fill="#FFFFFF" style="transform-origin:400px 368px"><g id="vm-eye-neutral" class="eye-set" data-state="neutral"><ellipse cx="334" cy="368" rx="33" ry="58"/><ellipse cx="466" cy="368" rx="33" ry="58"/></g><g id="vm-eye-blink" class="eye-set" data-state="blink" display="none"><g fill="none" stroke="#FFFFFF" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"><path d="M 310 374 L 358 374"/><path d="M 442 374 L 490 374"/></g></g><g id="vm-eye-look-left" class="eye-set" data-state="look-left" display="none"><ellipse cx="310" cy="368" rx="33" ry="58"/><ellipse cx="442" cy="368" rx="33" ry="58"/></g><g id="vm-eye-look-right" class="eye-set" data-state="look-right" display="none"><ellipse cx="358" cy="368" rx="33" ry="58"/><ellipse cx="490" cy="368" rx="33" ry="58"/></g><g id="vm-eye-happy-closed" class="eye-set" data-state="happy-closed" display="none"><g fill="none" stroke="#FFFFFF" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"><path d="M 304 382 C 308 348 360 348 364 382"/><path d="M 436 382 C 440 348 492 348 496 382"/></g></g><g id="vm-eye-joyful" class="eye-set" data-state="joyful" display="none"><g fill="none" stroke="#FFFFFF" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"><path d="M 300 376 C 304 332 364 332 368 376"/><path d="M 432 376 C 436 332 496 332 500 376"/></g></g><g id="vm-eye-squeeze" class="eye-set" data-state="squeeze" display="none"><g fill="none" stroke="#FFFFFF" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"><path d="M 314 338 L 356 368 L 314 398"/><path d="M 486 338 L 444 368 L 486 398"/></g></g><g id="vm-eye-angry" class="eye-set" data-state="angry" display="none"><g clip-path="url(#vm-clip-angry-l)"><ellipse cx="334" cy="368" rx="33" ry="58"/></g><g clip-path="url(#vm-clip-angry-r)"><ellipse cx="466" cy="368" rx="33" ry="58"/></g></g><g id="vm-eye-sleepy" class="eye-set" data-state="sleepy" display="none"><g clip-path="url(#vm-clip-sleepy)"><ellipse cx="334" cy="368" rx="33" ry="58"/><ellipse cx="466" cy="368" rx="33" ry="58"/></g></g><g id="vm-eye-wink-l" class="eye-set" data-state="wink-l" display="none"><ellipse cx="334" cy="368" rx="33" ry="58"/><g fill="none" stroke="#FFFFFF" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"><path d="M 486 338 L 444 368 L 486 398"/></g></g><g id="vm-eye-wink-r" class="eye-set" data-state="wink-r" display="none"><g fill="none" stroke="#FFFFFF" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"><path d="M 314 338 L 356 368 L 314 398"/></g><ellipse cx="466" cy="368" rx="33" ry="58"/></g></g><g id="vm-mouth" fill="#FFFFFF"><g id="vm-mouth-closed" class="mouth-set" data-state="closed"></g><g id="vm-mouth-smile" class="mouth-set" data-state="smile" display="none"><path d="M 383 410 Q 400 430 417 410" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/></g><g id="vm-mouth-open-o" class="mouth-set" data-state="open-o" display="none"><ellipse cx="400" cy="418" rx="9" ry="10.5"/></g><g id="vm-mouth-wide-grin" class="mouth-set" data-state="wide-grin" display="none"><path d="M 378 406 L 422 406 C 422 428 410 434 400 434 C 390 434 378 428 378 406 Z"/></g><g id="vm-mouth-flat" class="mouth-set" data-state="flat" display="none"><rect x="384" y="413" width="32" height="8" rx="4"/></g><g id="vm-mouth-say-ee" class="mouth-set" data-state="say-ee" display="none"><path d="M 376 410 L 424 410 C 420 424 410 428 400 428 C 390 428 380 424 376 410 Z"/></g><g id="vm-mouth-say-dd" class="mouth-set" data-state="say-dd" display="none"><path d="M 380 408 L 420 408 L 414 426 Q 400 431 386 426 Z" stroke-linejoin="round"/></g><g id="vm-mouth-surprised" class="mouth-set" data-state="surprised" display="none"><ellipse cx="400" cy="424" rx="12" ry="13"/></g></g></g></g></g></g></g></svg>`;

const PART_IDS = ['mascot', 'upper-body', 'leg-l', 'leg-r', 'torso', 'tail', 'tail-tip', 'wing-l', 'wing-r',
  'arm-l', 'arm-r', 'head', 'face', 'eyes', 'horn-l', 'horn-r'];

const EXPR = {
  neutral:     { eyes: 'neutral',      pose: {} },
  happy:       { eyes: 'happy-closed', pose: { head: { r: -3 }, 'wing-l': { r: 6 }, 'wing-r': { r: -6 }, 'arm-l': { r: 6 }, 'arm-r': { r: -6 } } },
  joyful:      { eyes: 'joyful',       pose: { head: { y: -6 }, 'wing-l': { r: 16 }, 'wing-r': { r: -16 }, 'arm-l': { r: 24 }, 'arm-r': { r: -24 } }, bounce: true },
  mischievous: { eyes: 'squeeze',      pose: { head: { r: 6 }, 'horn-l': { r: -5 }, 'horn-r': { r: 5 }, 'arm-l': { r: -6 } }, tailWag: true },
  determined:  { eyes: 'angry',        pose: { head: { y: 6 }, 'horn-l': { r: 7 }, 'horn-r': { r: -7 }, 'arm-l': { r: -8 }, 'arm-r': { r: 8 }, 'wing-l': { r: -6 }, 'wing-r': { r: 6 } } },
  sleepy:      { eyes: 'sleepy',       pose: { head: { r: 5, y: 8 }, 'wing-l': { r: -16 }, 'wing-r': { r: 16 }, 'arm-l': { r: -4 }, 'arm-r': { r: 4 }, 'horn-l': { r: -4 }, 'horn-r': { r: 4 } }, slow: true },
};

// Annotation state → how the mascot acts it out.
//   expr: rig expression · mouth: resting mouth · enter: action played on entering
//   every: [action, seconds] repeated while in the state · talk: mutter loop
export const MASCOT_STATES = {
  idle:       { expr: 'neutral',     mouth: 'closed',    label: 'No annotations' },
  sleepy:     { expr: 'sleepy',      mouth: 'closed',    label: 'Nothing happening for a while' },
  annotating: { expr: 'determined',  mouth: 'closed',    every: ['look', 3.2], label: 'Picking an element' },
  waiting:    { expr: 'happy',       mouth: 'smile',     enter: 'hop', every: ['wave', 6], label: 'New annotations, not sent yet' },
  working:    { expr: 'determined',  mouth: 'closed',    enter: 'fly', talk: true, label: 'Sent, Claude is on it' },
  reply:      { expr: 'neutral',     mouth: 'surprised', enter: 'wave', every: ['look', 4.5], label: 'Claude needs your answer' },
  done:       { expr: 'joyful',      mouth: 'wide-grin', enter: 'bounce', label: 'All done' },
  error:      { expr: 'mischievous', mouth: 'flat',      enter: 'hop', label: 'Could not reach Claude' },
};

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const env = (p, a = .15, b = .15) => clamp(Math.min(p / a, (1 - p) / b), 0, 1);
const rand = (a, b) => a + Math.random() * (b - a);

export function createMascot() {
  const el = document.createElement('div');
  el.className = 'vibe-mascot';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = SVG;
  const svg = el.querySelector('svg');
  const q = id => svg.querySelector('#vm-' + id);
  const parts = {};
  PART_IDS.forEach(id => { parts[id] = q(id); });
  const upper = parts['upper-body'];
  const shadow = q('shadow');

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const S = { state: 'idle', expr: 'neutral', eyes: 'neutral', mouth: 'closed', eyesOverride: null, mouthOverride: null };
  const bias = {}; PART_IDS.forEach(id => { bias[id] = { x: 0, y: 0, r: 0 }; });
  const actions = [];
  let now = 0, last = 0, idleT = 0, raf = null, nextEvery = 0;
  let blinkAt = 1.5, blinkStart = -1, talkNext = 0, talkPause = 0;

  const ACTIONS = {
    wave: { dur: 2.4,
      start() { upper.appendChild(parts['arm-r']); S.mouthOverride = 'smile'; },
      end() { upper.insertBefore(parts['arm-r'], parts.head); S.mouthOverride = null; },
      apply(p, t, A) { const e = ease(env(p, .18, .2));
        A('arm-r', { r: e * (-88 + 14 * Math.sin(t * TAU * 2.4)) }); A('arm-l', { r: 6 * e });
        A('head', { r: -6 * e }); A('wing-r', { r: -8 * e }); A('tail-tip', { r: 10 * e * Math.sin(t * TAU * 2.4) }); } },
    hop: { dur: 1.15,
      apply(p, t, A) {
        let y = 0, sx = 1, sy = 1, lift = 0;
        if (p < .2) { const k = Math.sin(p / .2 * Math.PI / 2); sy = 1 - .1 * k; sx = 1 + .06 * k; }
        else if (p < .72) { const k = (p - .2) / .52; y = -120 * Math.sin(k * Math.PI); lift = Math.sin(k * Math.PI); sy = 1 + .06 * (1 - k); sx = 1 - .03 * (1 - k); }
        else if (p < .86) { const k = Math.sin((p - .72) / .14 * Math.PI); sy = 1 - .12 * k; sx = 1 + .07 * k; }
        A('mascot', { y, sx, sy });
        A('wing-l', { r: 28 * lift }); A('wing-r', { r: -28 * lift });
        A('arm-l', { r: 34 * lift }); A('arm-r', { r: -34 * lift });
        A('leg-l', { r: 6 * lift }); A('leg-r', { r: -6 * lift });
        A('tail', { r: -10 * lift }); A('head', { y: 8 * lift }); } },
    bounce: { dur: 2.1,
      start() { S.eyesOverride = 'joyful'; S.mouthOverride = 'wide-grin'; },
      end() { S.eyesOverride = null; S.mouthOverride = null; },
      apply(p, t, A) { const e = env(p, .08, .12); const b = Math.abs(Math.sin(p * Math.PI * 4));
        const contact = Math.pow(1 - b, 6);
        A('mascot', { y: -48 * b * e, sy: 1 - .08 * contact * e, sx: 1 + .05 * contact * e });
        A('arm-l', { r: e * (30 + 10 * Math.sin(t * TAU * 4)) }); A('arm-r', { r: -e * (30 + 10 * Math.sin(t * TAU * 4)) });
        A('wing-l', { r: e * 20 * Math.sin(t * TAU * 4) + 10 * e }); A('wing-r', { r: -e * 20 * Math.sin(t * TAU * 4) - 10 * e });
        A('tail', { r: e * 12 * Math.sin(t * TAU * 3) }); A('tail-tip', { r: e * 18 * Math.sin(t * TAU * 3 - 1) });
        A('head', { r: e * 4 * Math.sin(t * TAU * 2) }); } },
    fly: { dur: 3.4,
      apply(p, t, A) { const e = ease(env(p, .25, .22)); const f = Math.sin(t * TAU * 5.5);
        A('mascot', { y: -90 * e + 8 * Math.sin(t * TAU * 1.2) * e });
        A('wing-l', { r: e * (14 + 30 * f) }); A('wing-r', { r: -e * (14 + 30 * f) });
        A('arm-l', { r: 18 * e }); A('arm-r', { r: -18 * e });
        A('leg-l', { r: 5 * e * Math.sin(t * TAU * 1.2) }); A('leg-r', { r: 5 * e * Math.sin(t * TAU * 1.2 + 1) });
        A('tail', { r: e * 10 * Math.sin(t * TAU * 1.4) }); A('tail-tip', { r: e * 14 * Math.sin(t * TAU * 1.4 - 1) });
        A('head', { y: -3 * e * f }); } },
    look: { dur: 2.6,
      apply(p, t, A) {
        const dir = p < .1 ? 0 : p < .45 ? -1 : p < .55 ? 0 : p < .9 ? 1 : 0;
        S.eyesOverride = dir < 0 ? 'look-left' : dir > 0 ? 'look-right' : null;
        const hp = Math.sin(p * TAU) * -1;
        A('head', { r: 5 * hp, x: -6 * hp }); },
      end() { S.eyesOverride = null; } },
  };

  function trigger(name) {
    const def = ACTIONS[name];
    if (!def || reduced?.matches) return;
    for (let i = actions.length - 1; i >= 0; i--) if (actions[i].name === name) { actions[i].def.end?.(); actions.splice(i, 1); }
    def.start?.();
    actions.push({ name, def, t0: now });
  }

  let shownEyes = null, shownMouth = null;
  function showSet(cls, name, prev) {
    if (name === prev) return prev;
    svg.querySelectorAll('.' + cls).forEach(g => g.setAttribute('display', g.dataset.state === name ? 'inline' : 'none'));
    return name;
  }
  function syncFace(eyes) {
    shownEyes = showSet('eye-set', eyes || S.eyesOverride || S.eyes, shownEyes);
    shownMouth = showSet('mouth-set', S.mouthOverride || S.mouth, shownMouth);
  }

  const lastTf = {};
  function write(P) {
    for (const id of PART_IDS) {
      const p = P[id]; if (!parts[id]) continue;
      const ident = Math.abs(p.x) < .005 && Math.abs(p.y) < .005 && Math.abs(p.r) < .0005 && Math.abs(p.sx - 1) < 1e-4 && Math.abs(p.sy - 1) < 1e-4;
      const v = ident ? '' : `translate(${p.x.toFixed(2)}px,${p.y.toFixed(2)}px) rotate(${p.r.toFixed(3)}deg) scale(${p.sx.toFixed(4)},${p.sy.toFixed(4)})`;
      if (lastTf[id] !== v) { parts[id].style.transform = v; lastTf[id] = v; }
    }
  }
  function blank() { const P = {}; PART_IDS.forEach(id => { P[id] = { x: 0, y: 0, r: 0, sx: 1, sy: 1 }; }); return P; }
  const adder = P => (id, d) => { const p = P[id]; if (d.x) p.x += d.x; if (d.y) p.y += d.y; if (d.r) p.r += d.r; if (d.sx) p.sx *= d.sx; if (d.sy) p.sy *= d.sy; };

  // Reduced motion: one static pose per state.
  function renderStatic() {
    const P = blank(); const A = adder(P);
    const pose = EXPR[S.expr].pose;
    for (const id in pose) A(id, pose[id]);
    write(P); syncFace();
  }

  function frame(ts) {
    raf = null;
    if (!el.isConnected || reduced?.matches) { if (reduced?.matches) renderStatic(); return; }
    const dt = Math.min(.05, ((ts - (last || ts)) / 1000)); last = ts; now += dt;
    const ex = EXPR[S.expr]; const def = MASCOT_STATES[S.state];
    idleT += dt * (ex.slow ? .6 : 1);
    const t = idleT;
    const P = blank(); const A = adder(P);

    // idle loop (breathing, wings, tail)
    const br = Math.sin(t * TAU / 3.2);
    A('upper-body', { sy: 1 + .014 * br, sx: 1 - .005 * br });
    A('head', { y: -2.5 * br, r: 1.4 * Math.sin(t * TAU / 6.5) });
    A('horn-l', { r: 1.8 * Math.sin(t * TAU / 3.2 - 1) }); A('horn-r', { r: -1.8 * Math.sin(t * TAU / 3.2 - 1) });
    const fl = Math.sin(t * TAU / 2.4);
    A('wing-l', { r: 7 * fl }); A('wing-r', { r: -7 * fl });
    A('tail', { r: 5 * Math.sin(t * TAU / 3.4) }); A('tail-tip', { r: 9 * Math.sin(t * TAU / 3.4 - .9) });
    A('arm-l', { r: 2 * Math.sin(t * TAU / 3.2 + .6) }); A('arm-r', { r: -2 * Math.sin(t * TAU / 3.2 + .6) });
    if (ex.bounce) A('mascot', { y: -8 * Math.abs(Math.sin(t * TAU * .9)) });
    if (ex.tailWag) A('tail-tip', { r: 12 * Math.sin(t * TAU * 1.8) });

    // expression pose, smoothed
    const k = Math.min(1, dt * 8);
    PART_IDS.forEach(id => { const tgt = ex.pose[id] || {}; const b = bias[id];
      b.x += ((tgt.x || 0) - b.x) * k; b.y += ((tgt.y || 0) - b.y) * k; b.r += ((tgt.r || 0) - b.r) * k;
      A(id, b); });

    // repeated action for the state
    if (def.every && !actions.length && now >= nextEvery) { trigger(def.every[0]); nextEvery = now + def.every[1]; }

    // actions
    for (let i = actions.length - 1; i >= 0; i--) {
      const a = actions[i]; const p = (now - a.t0) / a.def.dur;
      if (p >= 1) { a.def.end?.(); actions.splice(i, 1); continue; }
      a.def.apply(p, now, A);
    }

    // mutter while Claude works: short syllable bursts with pauses
    if (def.talk && !actions.length) {
      if (now >= talkNext) {
        if (now < talkPause) { S.mouthOverride = 'closed'; talkNext = talkPause; }
        else {
          S.mouthOverride = ['say-dd', 'say-ee', 'open-o', 'closed', 'say-dd', 'flat'][Math.floor(Math.random() * 6)];
          talkNext = now + rand(.08, .16);
          if (Math.random() < .08) talkPause = now + rand(.6, 1.4);
        }
      }
    }

    // blinks
    let eyeSy = 1;
    const curEyes = S.eyesOverride || S.eyes;
    if (['neutral', 'look-left', 'look-right', 'angry', 'sleepy'].includes(curEyes)) {
      if (blinkStart < 0 && now > blinkAt) blinkStart = now;
      if (blinkStart >= 0) {
        const p = (now - blinkStart) / .16;
        if (p >= 1) { blinkStart = -1; blinkAt = now + rand(2, 5.5); }
        else eyeSy = 1 - .9 * Math.sin(p * Math.PI);
      }
    }
    A('eyes', { sy: eyeSy });
    const gl = curEyes === 'look-left' ? -1 : curEyes === 'look-right' ? 1 : 0;
    A('face', { x: gl * 8 });

    syncFace();
    write(P);
    if (shadow) shadow.style.opacity = String(.16 * (1 - clamp(-P.mascot.y / 160, 0, .6)));
    raf = requestAnimationFrame(frame);
  }

  function run() { if (!raf && !reduced?.matches) { last = 0; raf = requestAnimationFrame(frame); } }

  function setState(name) {
    const def = MASCOT_STATES[name];
    if (!def || name === S.state) return;
    S.state = name;
    S.expr = def.expr; S.eyes = EXPR[def.expr].eyes; S.mouth = def.mouth || 'closed';
    if (!def.talk) S.mouthOverride = null;
    el.dataset.state = name;
    el.title = def.label;
    while (actions.length) actions.pop().def.end?.();
    nextEvery = now + (def.every ? def.every[1] / 2 : 0);
    if (def.enter) trigger(def.enter);
    if (reduced?.matches) renderStatic(); else run();
  }

  reduced?.addEventListener?.('change', () => { if (reduced.matches) renderStatic(); else run(); });
  el.dataset.state = 'idle';
  if (reduced?.matches) renderStatic(); else run();

  return {
    el,
    setState,
    get state() { return S.state; },
    trigger,
    resume: run,
  };
}
