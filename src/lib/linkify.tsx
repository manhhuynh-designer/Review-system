import React from 'react'

/**
 * Converts plain text URLs into clickable links
 * Supports http://, https://, and www. URLs
 */
export function linkifyText(text: string): React.ReactNode {
    if (!text) return text

    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g
    const parts = text.split(urlRegex)

    return parts.map((part, i) => {
        if (part.match(urlRegex)) {
            const url = part.startsWith('www.') ? `https://${part}` : part
            return (
                <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline hover:text-blue-600 transition-colors"
                    onClick={(e) => e.stopPropagation()} // Prevent parent click handlers
                >
                    {part}
                </a>
            )
        }
        return <React.Fragment key={i}>{part}</React.Fragment>
    })
}
