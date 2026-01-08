import { create } from 'zustand'
import {
    collection,

    updateDoc,
    doc,
    query,
    where,
    onSnapshot,
    Timestamp,
    getDoc,
    setDoc,
    addDoc
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { ProjectInvitation } from '../types'
import toast from 'react-hot-toast'
import { generateToken, generateOTP } from '@/utils/security' // We will create this

interface InvitationState {
    invitations: ProjectInvitation[]
    loading: boolean

    // Actions
    createInvitations: (
        projectId: string,
        emails: string[],
        resourceType: 'project' | 'file',
        resourceId: string,
        isPrivate: boolean
    ) => Promise<void>

    revokeInvitation: (id: string) => Promise<void>
    getInvitations: (projectId: string) => () => void // Returns unsubscribe

    // Verification
    validateToken: (token: string) => Promise<{ isValid: boolean, invitation?: ProjectInvitation, error?: string }>
    requestOTP: (invitationId: string) => Promise<void>
    verifyOTP: (invitationId: string, code: string, deviceId: string) => Promise<boolean>
}

export const useInvitationStore = create<InvitationState>((set) => ({
    invitations: [],
    loading: false,

    createInvitations: async (projectId, emails, resourceType, resourceId, isPrivate) => {
        set({ loading: true })
        try {
            const now = Timestamp.now()
            const batchPromises = emails.map(email => {
                const token = generateToken() // Implement this util

                const invitation: Partial<ProjectInvitation> = {
                    projectId,
                    resourceType,
                    resourceId,
                    email,
                    token,
                    status: 'pending',
                    createdAt: now,
                    allowedDevices: [],
                    // Trigger Email Extension format
                    to: email,
                    message: {
                        subject: `Lời mời xem ${resourceType === 'project' ? 'Dự án' : 'File'}`,
                        html: `
              <p>Bạn đã được mời xem ${resourceType === 'project' ? 'dự án' : 'file'}.</p>
              <p>Click vào link bên dưới để truy cập:</p>
              <a href="${window.location.origin}/review/${projectId}?token=${token}">Xem ngay</a>
              ${isPrivate ? '<p>Lưu ý: Link này được bảo mật và sẽ yêu cầu xác thực thiết bị.</p>' : ''}
            `
                    }
                }

                // Dual Write:
                // 1. Write to 'project_invitations' (State)
                const statePromise = setDoc(doc(db, 'project_invitations', token), invitation)

                // 2. Write to 'mail' (Trigger)
                const mailPromise = addDoc(collection(db, 'mail'), {
                    to: email,
                    message: invitation.message
                })

                return Promise.all([statePromise, mailPromise])
            })

            await Promise.all(batchPromises)

            // If private mode, ensure project has accessLevel='token_required'
            if (isPrivate) {
                await updateDoc(doc(db, 'projects', projectId), {
                    accessLevel: 'token_required',
                    updatedAt: now
                })
            }

            toast.success(`Đã gửi ${emails.length} lời mời`)
        } catch (error: any) {
            console.error('Error sending invitations:', error)
            toast.error('Lỗi gửi lời mời: ' + error.message)
            throw error
        } finally {
            set({ loading: false })
        }
    },

    revokeInvitation: async (id: string) => {
        try {
            await updateDoc(doc(db, 'project_invitations', id), {
                status: 'revoked'
            })
            toast.success('Đã hủy lời mời')
        } catch (error) {
            toast.error('Lỗi hủy lời mời')
        }
    },

    getInvitations: (projectId: string) => {
        const q = query(
            collection(db, 'project_invitations'),
            where('projectId', '==', projectId),
            where('status', '!=', 'revoked') // Optional: keep history or hide?
        )

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const invitations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ProjectInvitation[]
            set({ invitations })
        })

        return unsubscribe
    },

    validateToken: async (token: string) => {
        try {
            // Direct get by ID (since ID is the token)
            const docRef = doc(db, 'project_invitations', token)
            const docSnap = await getDoc(docRef)

            if (!docSnap.exists()) {
                return { isValid: false, error: 'Token invalid' }
            }

            const invitation = { id: docSnap.id, ...docSnap.data() } as ProjectInvitation

            if (invitation.status === 'revoked' || invitation.status === 'expired') {
                return { isValid: false, error: 'Invitation expired or revoked' }
            }

            return { isValid: true, invitation }
        } catch (error) {
            return { isValid: false, error: 'System error' }
        }
    },

    requestOTP: async (invitationId: string) => {
        // Stub for OTP logic - requires Cloud Function or another Trigger Email entry
        // For now, we simulate by updating the doc which might trigger an email extension
        const code = generateOTP()
        await updateDoc(doc(db, 'project_invitations', invitationId), {
            verificationCode: {
                code,
                expiresAt: Timestamp.fromMillis(Date.now() + 15 * 60 * 1000), // 15 mins
                attempts: 0
            }
        })

        // Dual Write: Trigger Email
        await addDoc(collection(db, 'mail'), {
            to: (await getDoc(doc(db, 'project_invitations', invitationId))).data()?.email,
            message: {
                subject: 'Mã xác thực OTP',
                html: `<p>Mã OTP của bạn là: <strong>${code}</strong></p><p>Mã có hiệu lực trong 15 phút.</p>`
            }
        })

        toast.success('Mã OTP đã được gửi đến email của bạn')
    },

    verifyOTP: async (invitationId: string, code: string, deviceId: string) => {
        const docRef = doc(db, 'project_invitations', invitationId)
        const docSnap = await getDoc(docRef)
        if (!docSnap.exists()) return false

        const data = docSnap.data() as ProjectInvitation
        if (!data.verificationCode || data.verificationCode.code !== code) {
            return false
        }

        if (data.verificationCode.expiresAt.toMillis() < Date.now()) {
            toast.error('Mã OTP đã hết hạn')
            return false
        }

        // Success: Bind device
        await updateDoc(docRef, {
            allowedDevices: [...data.allowedDevices, deviceId],
            verificationCode: null, // Clear code
            status: 'accepted'
        })

        return true
    }
}))
