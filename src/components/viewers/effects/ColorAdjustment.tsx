import { forwardRef, useMemo, useLayoutEffect } from 'react'
import { Effect, BlendFunction } from 'postprocessing'
import { Uniform } from 'three'

const fragmentShader = `
uniform float exposure;
uniform float gamma;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Apply exposure (scale intensity)
  vec3 color = max(inputColor.rgb * exposure, vec3(0.0));
  
  // Apply gamma correction
  float g = max(gamma, 0.01);
  outputColor = vec4(pow(color, vec3(1.0 / g)), inputColor.a);
}
`

class ColorAdjustmentEffectImpl extends Effect {
    constructor(exposure = 1.0, gamma = 1.0) {
        super('ColorAdjustmentEffect', fragmentShader, {
            blendFunction: BlendFunction.NORMAL,
            uniforms: new Map([
                ['exposure', new Uniform(exposure)],
                ['gamma', new Uniform(gamma)]
            ]),
        })
    }

    set exposure(value: number) {
        const uniform = this.uniforms.get('exposure')
        if (uniform) uniform.value = value
    }

    get exposure() {
        return this.uniforms.get('exposure')?.value ?? 1.0
    }

    set gamma(value: number) {
        const uniform = this.uniforms.get('gamma')
        if (uniform) uniform.value = value
    }

    get gamma() {
        return this.uniforms.get('gamma')?.value ?? 1.0
    }
}

interface ColorAdjustmentProps {
    exposure?: number
    gamma?: number
}

export const ColorAdjustment = forwardRef<Effect, ColorAdjustmentProps>(
    ({ exposure = 1.0, gamma = 1.0 }, ref) => {
        const effect = useMemo(() => new ColorAdjustmentEffectImpl(exposure, gamma), [])

        useLayoutEffect(() => {
            effect.exposure = exposure
        }, [effect, exposure])

        useLayoutEffect(() => {
            effect.gamma = gamma
        }, [effect, gamma])

        // Use effect directly in primitive
        return <primitive object={effect} ref={ref} dispose={null} />
    }
)

ColorAdjustment.displayName = 'ColorAdjustment'
