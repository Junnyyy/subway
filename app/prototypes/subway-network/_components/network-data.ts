export type RouteFamily = {
  id: string;
  name: string;
  services: string[];
  color: string;
  foreground: "light" | "dark";
  geographicPath: string;
  diagramPath: string;
  duration: number;
};

export type Point = {
  x: number;
  y: number;
};

export type Station = Point & {
  id: string;
  interchange?: boolean;
};

export const boroughs = [
  {
    id: "staten-island",
    name: "Staten Island",
    label: { x: 222, y: 642 },
    path: "M78 615C113 561 194 520 278 525C335 529 384 572 398 630C364 685 298 730 210 735C144 727 95 684 78 615Z",
  },
  {
    id: "manhattan",
    name: "Manhattan",
    label: { x: 468, y: 343 },
    path: "M469 96C491 86 519 99 531 126C548 184 558 249 570 322C584 414 603 516 606 571C607 607 585 635 557 640C532 632 520 607 523 573C528 503 520 439 509 370C497 293 482 220 468 157C463 134 459 109 469 96Z",
  },
  {
    id: "bronx",
    name: "The Bronx",
    label: { x: 651, y: 147 },
    path: "M450 72C521 31 635 25 729 55C808 80 860 139 870 209C830 254 755 280 671 285C603 275 548 247 519 207C494 168 465 123 450 72Z",
  },
  {
    id: "queens",
    name: "Queens",
    label: { x: 900, y: 341 },
    path: "M622 282C738 228 924 205 1089 246C1154 291 1184 368 1164 458C1114 521 1015 561 898 569C802 551 727 514 681 459C650 405 629 344 622 282Z",
  },
  {
    id: "brooklyn",
    name: "Brooklyn",
    label: { x: 785, y: 610 },
    path: "M557 475C644 425 754 414 854 443C943 470 1021 526 1055 611C1020 681 929 727 819 744C711 738 623 702 574 642C548 592 540 529 557 475Z",
  },
] as const;

// Official MTA service colors, represented in OKLCH for perceptual consistency.
// Source values: MTA Colors dataset, New York State Open Data.
export const routeFamilies: RouteFamily[] = [
  {
    id: "red",
    name: "Broadway–Seventh Avenue",
    services: ["1", "2", "3"],
    color: "oklch(0.569 0.213 23.613)",
    foreground: "light",
    geographicPath:
      "M480 67C491 143 502 236 522 354C537 449 551 548 560 617C598 665 650 699 711 718",
    diagramPath: "M330 82L420 174L420 590L523 695",
    duration: 30,
  },
  {
    id: "green",
    name: "Lexington Avenue",
    services: ["4", "5", "6"],
    color: "oklch(0.599 0.153 153.408)",
    foreground: "light",
    geographicPath:
      "M652 67C612 161 568 237 551 329C560 420 579 518 585 609C640 661 721 691 821 708",
    diagramPath: "M500 82L500 590L603 695",
    duration: 31,
  },
  {
    id: "blue",
    name: "Eighth Avenue",
    services: ["A", "C", "E"],
    color: "oklch(0.516 0.186 257.355)",
    foreground: "light",
    geographicPath:
      "M419 127C474 199 518 280 535 379C542 477 552 563 570 621C663 650 777 649 914 646",
    diagramPath: "M210 186L370 346L370 590L764 695",
    duration: 36,
  },
  {
    id: "orange",
    name: "Sixth Avenue",
    services: ["B", "D", "F", "M"],
    color: "oklch(0.668 0.184 47.333)",
    foreground: "light",
    geographicPath:
      "M735 123C660 198 585 273 548 354C552 444 566 544 575 619C635 682 761 720 902 715",
    diagramPath: "M692 106L530 268L530 590L692 702",
    duration: 34,
  },
  {
    id: "yellow",
    name: "Broadway",
    services: ["N", "Q", "R", "W"],
    color: "oklch(0.826 0.161 84.718)",
    foreground: "dark",
    geographicPath:
      "M991 224C859 255 719 300 563 335C552 429 567 534 586 614C650 640 731 666 821 713",
    diagramPath: "M1042 177L630 307L600 590L792 702",
    duration: 38,
  },
  {
    id: "purple",
    name: "Flushing",
    services: ["7"],
    color: "oklch(0.520 0.182 325.025)",
    foreground: "light",
    geographicPath: "M529 365C665 354 802 333 1032 319",
    diagramPath: "M390 359L1012 359",
    duration: 25,
  },
  {
    id: "lime",
    name: "Crosstown",
    services: ["G"],
    color: "oklch(0.628 0.128 123.790)",
    foreground: "light",
    geographicPath:
      "M825 293C775 358 724 428 689 508C672 575 690 641 721 702",
    diagramPath: "M812 258L690 380L690 660",
    duration: 28,
  },
  {
    id: "gray",
    name: "Canarsie",
    services: ["L"],
    color: "oklch(0.612 0.015 241.101)",
    foreground: "light",
    geographicPath: "M554 480C681 473 801 487 947 501",
    diagramPath: "M430 485L943 485",
    duration: 24,
  },
  {
    id: "brown",
    name: "Nassau Street",
    services: ["J", "Z"],
    color: "oklch(0.521 0.086 58.588)",
    foreground: "light",
    geographicPath:
      "M590 539C691 549 780 558 861 525C921 499 980 483 1047 474",
    diagramPath: "M500 550L810 550L1022 458",
    duration: 31,
  },
  {
    id: "sir",
    name: "Staten Island Railway",
    services: ["SIR"],
    color: "oklch(0.603 0.117 227.159)",
    foreground: "light",
    geographicPath: "M148 545C202 594 245 650 291 716",
    diagramPath: "M148 545L291 716",
    duration: 22,
  },
];

export const geographicStations: Station[] = [
  { id: "bronx-hub", x: 616, y: 157 },
  { id: "queens-plaza", x: 720, y: 349, interchange: true },
  { id: "times-square", x: 529, y: 365, interchange: true },
  { id: "union-square", x: 555, y: 480, interchange: true },
  { id: "fulton-street", x: 579, y: 609, interchange: true },
  { id: "atlantic", x: 670, y: 650, interchange: true },
  { id: "bedford", x: 733, y: 481 },
  { id: "jamaica", x: 992, y: 348, interchange: true },
  { id: "coney-island", x: 821, y: 713, interchange: true },
  { id: "st-george", x: 148, y: 545, interchange: true },
];

export const diagramStations: Station[] = [
  { id: "north", x: 500, y: 174 },
  { id: "queens-plaza", x: 690, y: 359, interchange: true },
  { id: "times-square", x: 500, y: 359, interchange: true },
  { id: "union-square", x: 500, y: 485, interchange: true },
  { id: "canal", x: 500, y: 550, interchange: true },
  { id: "fulton-street", x: 600, y: 590, interchange: true },
  { id: "atlantic", x: 690, y: 660, interchange: true },
  { id: "jamaica", x: 943, y: 485, interchange: true },
  { id: "coney-island", x: 792, y: 702, interchange: true },
  { id: "st-george", x: 148, y: 545, interchange: true },
];

export const keyPlaceLabels = [
  { text: "Times Sq", x: 512, y: 347, anchor: "end" },
  { text: "Union Sq", x: 537, y: 466, anchor: "end" },
  { text: "Fulton St", x: 562, y: 596, anchor: "end" },
  { text: "Atlantic Av", x: 686, y: 670, anchor: "start" },
  { text: "Queensboro", x: 736, y: 338, anchor: "start" },
] as const;

