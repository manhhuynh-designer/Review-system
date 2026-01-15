import React from 'react'

/**
 * Converts plain text URLs and basic markdown into clickable links and styled text
 * Supports http://, https://, and www. URLs
 * Supports basic markdown: **bold**, *italic*, and line breaks
 */
export function linkifyText(text: string): React.ReactNode {
    if (!text) return text

    // First, handle markdown-style links: [text](url)
    const markdownRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/g
    const segments: Array<React.ReactNode> = []
    let lastIndex = 0

    const parseBasicMarkdown = (input: string, keyPrefix: string): React.ReactNode[] => {
        if (!input) return []

        // Handle line breaks first
        const lines = input.split('\n')
        const result: React.ReactNode[] = []

        lines.forEach((line, lineIdx) => {
            // Process bold: **text**
            const boldRegex = /\*\*([^*]+)\*\*/g
            let lastIdx = 0
            let match: RegExpExecArray | null

            while ((match = boldRegex.exec(line)) !== null) {
                const [full, content] = match
                const start = match.index

                // Add text before bold
                if (start > lastIdx) {
                    const before = line.slice(lastIdx, start)
                    result.push(...parseItalic(before, `${keyPrefix}-${lineIdx}-${result.length}`))
                }

                // Add bold text
                result.push(
                    <strong key={`${keyPrefix}-${lineIdx}-${result.length}`} className="font-bold">
                        {parseItalic(content, `${keyPrefix}-${lineIdx}-b-${result.length}`)}
                    </strong>
                )

                lastIdx = start + full.length
            }

            // Add remaining text after last bold match
            if (lastIdx < line.length) {
                result.push(...parseItalic(line.slice(lastIdx), `${keyPrefix}-${lineIdx}-${result.length}`))
            }

            // Add <br /> except for the last line
            if (lineIdx < lines.length - 1) {
                result.push(<br key={`${keyPrefix}-br-${lineIdx}`} />)
            }
        })

        return result
    }

    const parseItalic = (input: string, keyPrefix: string): React.ReactNode[] => {
        const italicRegex = /\*([^*]+)\*/g
        const result: React.ReactNode[] = []
        let lastIdx = 0
        let match: RegExpExecArray | null

        while ((match = italicRegex.exec(input)) !== null) {
            const [full, content] = match
            const start = match.index

            if (start > lastIdx) {
                result.push(<span key={`${keyPrefix}-i-pre-${result.length}`}>{input.slice(lastIdx, start)}</span>)
            }

            result.push(
                <em key={`${keyPrefix}-i-${result.length}`} className="italic">
                    {content}
                </em>
            )

            lastIdx = start + full.length
        }

        if (lastIdx < input.length) {
            result.push(<span key={`${keyPrefix}-i-post-${result.length}`}>{input.slice(lastIdx)}</span>)
        }

        return result
    }

    const pushPlain = (plain: string) => {
        if (!plain) return
        // Then, linkify plain URLs inside the plain text
        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g
        const parts = plain.split(urlRegex)
        parts.forEach((part, i) => {
            if (part.match(urlRegex)) {
                const url = part.startsWith('www.') ? `https://${part}` : part
                // Display domain as a shorter title
                try {
                    const domain = new URL(url).hostname.replace(/^www\./, '')
                    segments.push(
                        <a
                            key={`u-${segments.length}-${i}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {domain}
                            <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    )
                } catch {
                    segments.push(
                        <a
                            key={`u-${segments.length}-${i}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part}
                            <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    )
                }
            } else {
                segments.push(<React.Fragment key={`p-${segments.length}-${i}`}>{parseBasicMarkdown(part, `md-${segments.length}-${i}`)}</React.Fragment>)
            }
        })
    }

    let match: RegExpExecArray | null
    while ((match = markdownRegex.exec(text)) !== null) {
        const [full, label, rawUrl] = match
        const start = match.index
        const end = start + full.length
        // push any plain text before this match
        pushPlain(text.slice(lastIndex, start))
        const url = rawUrl.startsWith('www.') ? `https://${rawUrl}` : rawUrl
        segments.push(
            <a
                key={`m-${segments.length}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
            >
                {label}
                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
            </a>
        )
        lastIndex = end
    }

    // push remaining text
    pushPlain(text.slice(lastIndex))

    return segments
}
