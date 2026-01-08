export const generateToken = (length = 32): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    const randomValues = new Uint32Array(length)
    crypto.getRandomValues(randomValues)
    for (let i = 0; i < length; i++) {
        token += chars[randomValues[i] % chars.length]
    }
    return token
}

export const generateOTP = (length = 6): string => {
    const chars = '0123456789'
    let otp = ''
    const randomValues = new Uint32Array(length)
    crypto.getRandomValues(randomValues)
    for (let i = 0; i < length; i++) {
        otp += chars[randomValues[i] % chars.length]
    }
    return otp
}
