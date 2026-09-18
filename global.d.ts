import "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}