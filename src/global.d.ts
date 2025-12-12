declare global {
    namespace JSX {
        interface IntrinsicElements {
            'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
                src?: string;
                'ios-src'?: string;
                alt?: string;
                ar?: boolean;
                'ar-modes'?: string;
                'camera-controls'?: boolean;
                'ar-scale'?: string;
                ref?: any;
            }, HTMLElement>;
        }
    }
}

export { };
