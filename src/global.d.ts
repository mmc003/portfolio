// Declare `require.context` for Webpack
interface WebpackRequire extends NodeRequire {
    context(
      directory: string,
      useSubdirectories: boolean,
      regExp: RegExp
    ): {
      keys: () => string[];
      (key: string): any;
    };
  }
  
  declare var require: WebpackRequire;
  
  // Type declarations for static asset imports
  declare module "*.jpg" {
    const value: string;
    export default value;
  }
  
  declare module "*.jpeg" {
    const value: string;
    export default value;
  }
  
  // CSS/SCSS Module Declarations
  declare module "*.css" {
    const classes: { [key: string]: string };
    export default classes;
  }
  
  declare module "*.scss" {
    const classes: { [key: string]: string };
    export default classes;
  }
  
  declare module "*.sass" {
    const classes: { [key: string]: string };
    export default classes;
  }
  