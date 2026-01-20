import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

export type FileType = 'image' | 'video' | 'sequence' | 'pdf' | 'model'

interface TourOptions {
  fileType: FileType
  isMobile: boolean
}

/**
 * Start a guided tour for the file viewer based on file type and device
 */
async function getClientIp(): Promise<string | null> {
  try {
    const cached = localStorage.getItem('client_ip')
    if (cached) return cached

    const resp = await fetch('https://api.ipify.org?format=json')
    if (!resp.ok) return null
    const json = await resp.json()
    const ip = json?.ip
    if (ip) {
      localStorage.setItem('client_ip', ip)
      return ip
    }
  } catch (e) {
    // ignore
  }
  return null
}

export async function startFileTour({ fileType, isMobile }: TourOptions) {
  let steps: any[] = []

  // Common comment step for desktop
  const commentStep = {
    element: '#comments-sidebar',
    popover: {
      title: 'Bình luận & Thảo luận',
      description: 'Xem các bình luận, thêm phản hồi hoặc đánh dấu đã giải quyết tại đây.',
      side: 'left',
      align: 'start'
    }
  }

  const versionToggleStep = {
    element: '#comments-version-toggle',
    popover: {
      title: 'Lọc phiên bản bình luận',
      description: 'Chuyển đổi giữa xem tất cả bình luận hoặc chỉ xem bình luận của phiên bản hiện tại.',
      side: 'left',
      align: 'start'
    }
  }

  const compareStep = {
    element: '#header-compare-btn',
    popover: {
      title: 'So sánh phiên bản',
      description: 'So sánh trực quan giữa hai phiên bản ảnh khác nhau.',
      side: 'bottom',
      align: 'start'
    }
  }

  const attachStep = {
    element: '#comment-attach-button',
    popover: {
      title: 'Đính kèm File',
      description: 'Đính kèm ảnh hoặc tài liệu vào bình luận của bạn.',
      side: 'left',
      align: 'start'
    }
  }

  const linkStep = {
    element: '#comment-link-button',
    popover: {
      title: 'Chèn liên kết',
      description: 'Thêm đường dẫn (link) vào bình luận.',
      side: 'left',
      align: 'start'
    }
  }

  const drawStep = {
    element: '#comment-draw-button',
    popover: {
      title: 'Vẽ/Ghi chú',
      description: 'Vẽ trực tiếp lên hình ảnh để minh họa ý kiến của bạn.',
      side: 'left',
      align: 'start'
    }
  }

  // Common header steps for desktop
  const headerSteps = [
    {
      element: '#header-version-dropdown',
      popover: {
        title: 'Quản lý phiên bản',
        description: 'Xem lịch sử, chuyển đổi phiên bản hoặc tải lên phiên bản mới tại đây.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#header-share-download-group',
      popover: {
        title: 'Chia sẻ & Tải xuống',
        description: 'Chia sẻ link file hoặc tải xuống trực tiếp về máy.',
        side: 'bottom',
        align: 'start'
      }
    }
  ]

  // ========== IMAGE TOURS ==========
  if (fileType === 'image') {
    if (isMobile) {
      steps = [
        {
          element: '#preview-container',
          popover: {
            title: 'Xem hình ảnh',
            description: 'Chạm để phóng to/thu nhỏ và kéo để di chuyển ảnh.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#mobile-add-comment',
          popover: {
            title: 'Thêm bình luận',
            description: 'Nhập bình luận, đính kèm file hoặc vẽ ghi chú tại đây.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#mobile-comment-attach-button',
          popover: {
            title: 'Đính kèm file',
            description: 'Chọn ảnh hoặc file để đính kèm.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '#mobile-comment-link-button',
          popover: {
            title: 'Chèn liên kết',
            description: 'Thêm đường dẫn vào bình luận.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '#mobile-comment-draw-button',
          popover: {
            title: 'Vẽ ghi chú',
            description: 'Mở công cụ vẽ để đánh dấu trên ảnh.',
            side: 'top',
            align: 'start'
          }
        }
      ]
    } else {
      steps = [
        ...headerSteps,
        compareStep,
        {
          element: '#preview-container',
          popover: {
            title: 'Xem hình ảnh',
            description: 'Bạn có thể phóng to, thu nhỏ và di chuyển hình ảnh để xem chi tiết.',
            side: 'bottom',
            align: 'center'
          }
        },
        commentStep,
        versionToggleStep,
        attachStep,
        linkStep,
        drawStep
      ]
    }
  }

  // ========== VIDEO TOURS ==========
  else if (fileType === 'video') {
    if (isMobile) {
      steps = [
        {
          element: '#preview-container',
          popover: {
            title: 'Video player',
            description: 'Chạm để phát/dừng video.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#video-timeline-container',
          popover: {
            title: 'Timeline',
            description: 'Chạm vào timeline để nhảy tới thời điểm đó. Các điểm đỏ là vị trí có bình luận.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#video-controls-settings',
          popover: {
            title: 'Cài đặt Overlay',
            description: 'Mở menu để chọn Safe Zone và Composition Guides. Tùy chỉnh màu sắc và độ trong suốt của các đường hướng dẫn.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#mobile-nav-toggle',
          popover: {
            title: 'Chế độ điều hướng',
            description: 'Chuyển đổi giữa điều khiển theo frame (F) hoặc marker (M).',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#mobile-filter-toggle',
          popover: {
            title: 'Lọc bình luận',
            description: 'Bật để chỉ hiển thị bình luận tại thời điểm hiện tại.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#mobile-add-comment',
          popover: {
            title: 'Thêm bình luận',
            description: 'Nhập bình luận cho video tại thời điểm hiện tại.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#mobile-comment-attach-button',
          popover: {
            title: 'Đính kèm',
            description: 'Đính kèm ảnh hoặc file.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '#mobile-comment-link-button',
          popover: {
            title: 'Chèn liên kết',
            description: 'Thêm đường dẫn vào bình luận.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '#mobile-comment-draw-button',
          popover: {
            title: 'Vẽ ghi chú',
            description: 'Vẽ ghi chú trên frame video.',
            side: 'top',
            align: 'start'
          }
        }
      ]
    } else {
      steps = [
        ...headerSteps,
        {
          element: '#header-video-compare-btn',
          popover: {
            title: 'So sánh phiên bản',
            description: 'Bật chế độ so sánh để xem hai phiên bản video cạnh nhau với playback đồng bộ.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#preview-container',
          popover: {
            title: 'Trình phát Video',
            description: 'Sử dụng các phím tắt (Space để phát/dừng, Mũi tên để tua) để điều khiển.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#video-controls-export',
          popover: {
            title: 'Sao chép Frame',
            description: 'Nhấn vào đây để lưu ảnh frame hiện tại vào bộ nhớ tạm (clipboard).',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#video-controls-settings',
          popover: {
            title: 'Overlay Settings',
            description: 'Mở menu để chọn Safe Zone (vùng an toàn) và Composition Guides (đường hướng dẫn bố cục). Điều chỉnh màu sắc và độ trong suốt để phù hợp với công việc của bạn.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#video-controls-fullscreen',
          popover: {
            title: 'Toàn màn hình',
            description: 'Bật chế độ toàn màn hình để xem video rõ hơn.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#filter-time-toggle',
          popover: {
            title: 'Lọc theo thời gian',
            description: 'Bật tùy chọn này để chỉ hiển thị bình luận tại thời điểm hiện tại.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#video-timeline-container',
          popover: {
            title: 'Timeline & Markers',
            description: 'Điểm đánh dấu trên timeline hiển thị vị trí các bình luận và ghi chú.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#comments-resize-handle',
          popover: {
            title: 'Thay đổi kích thước khung bình luận',
            description: 'Kéo thanh này sang trái hoặc phải để thay đổi chiều rộng khung bình luận.',
            side: 'left',
            align: 'center'
          }
        },
        commentStep,
        versionToggleStep,
        attachStep,
        linkStep,
        drawStep
      ]
    }
  }

  // ========== SEQUENCE TOURS ==========
  else if (fileType === 'sequence') {
    if (isMobile) {
      steps = [
        {
          element: '#preview-container',
          popover: {
            title: 'Chuỗi hình ảnh',
            description: 'Vuốt hoặc chạm để xem từng frame.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#grid-toggle',
          popover: {
            title: 'Chế độ xem',
            description: 'Chuyển đổi giữa chế độ video, carousel hoặc lưới.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#mobile-add-comment',
          popover: {
            title: 'Thêm bình luận',
            description: 'Nhập bình luận cho frame hiện tại.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#mobile-comment-attach-button',
          popover: {
            title: 'Đính kèm',
            description: 'Đính kèm file vào bình luận.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '#mobile-comment-link-button',
          popover: {
            title: 'Chèn liên kết',
            description: 'Thêm đường dẫn vào bình luận.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '#mobile-comment-draw-button',
          popover: {
            title: 'Vẽ ghi chú',
            description: 'Vẽ ghi chú trên frame.',
            side: 'top',
            align: 'start'
          }
        }
      ]
    } else {
      steps = [
        ...headerSteps,
        {
          element: '#preview-container',
          popover: {
            title: 'Chuỗi hình ảnh',
            description: 'Di chuột hoặc kéo để xem chuỗi hình ảnh. Nhấn phím cách để phát tự động.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#grid-toggle',
          popover: {
            title: 'Chế độ xem',
            description: 'Chuyển đổi giữa chế độ phát, carousel hoặc lưới để duyệt frames.',
            side: 'bottom',
            align: 'end'
          }
        },
        {
          element: '#filter-time-toggle',
          popover: {
            title: 'Lọc theo thời gian',
            description: 'Bật tùy chọn này để chỉ hiển thị bình luận ở frame hiện tại.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#comments-resize-handle',
          popover: {
            title: 'Thay đổi kích thước khung bình luận',
            description: 'Kéo thanh này sang trái hoặc phải để thay đổi chiều rộng khung bình luận.',
            side: 'left',
            align: 'center'
          }
        },
        commentStep,
        versionToggleStep,
        attachStep,
        linkStep,
        drawStep
      ]
    }
  }

  // ========== PDF TOURS ==========
  else if (fileType === 'pdf') {
    if (isMobile) {
      steps = [
        {
          element: '#preview-container',
          popover: {
            title: 'Xem PDF',
            description: 'Vuốt để chuyển trang, chạm để phóng to.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#mobile-add-comment',
          popover: {
            title: 'Thêm bình luận',
            description: 'Nhập bình luận cho trang hiện tại.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#mobile-comment-attach-button',
          popover: {
            title: 'Đính kèm',
            description: 'Đính kèm tài liệu hoặc ảnh.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '#mobile-comment-link-button',
          popover: {
            title: 'Chèn liên kết',
            description: 'Thêm đường dẫn vào bình luận.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '#mobile-comment-draw-button',
          popover: {
            title: 'Vẽ ghi chú',
            description: 'Vẽ ghi chú lên trang PDF.',
            side: 'top',
            align: 'start'
          }
        }
      ]
    } else {
      steps = [
        ...headerSteps,
        {
          element: '#preview-container',
          popover: {
            title: 'Xem PDF',
            description: 'Duyệt trang, phóng to/thu nhỏ và chuyển trang để xem chi tiết.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#comments-resize-handle',
          popover: {
            title: 'Thay đổi kích thước khung bình luận',
            description: 'Kéo để thay đổi chiều rộng khung bình luận khi đọc tài liệu.',
            side: 'left',
            align: 'center'
          }
        },
        commentStep,
        versionToggleStep,
        attachStep,
        linkStep,
        drawStep
      ]
    }
  }

  // ========== 3D MODEL TOURS ==========
  else if (fileType === 'model') {
    if (isMobile) {
      steps = [
        {
          element: '#preview-container',
          popover: {
            title: 'Mô hình 3D',
            description: 'Chạm và kéo để xoay, véo để phóng to/thu nhỏ mô hình.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#mobile-3d-toolbar',
          popover: {
            title: 'Thanh công cụ 3D',
            description: 'Các nút điều khiển hiển thị mô hình 3D.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#mobile-model-auto-rotate',
          popover: {
            title: 'Tự động xoay',
            description: 'Bật/tắt tự động xoay mô hình.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#mobile-model-render-mode',
          popover: {
            title: 'Chế độ hiển thị',
            description: 'Chuyển đổi Standard, Wireframe hoặc Matcap.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#mobile-model-screenshot',
          popover: {
            title: 'Chụp ảnh',
            description: 'Lưu ảnh PNG của góc nhìn hiện tại.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#mobile-model-reset',
          popover: {
            title: 'Đặt lại góc nhìn',
            description: 'Quay về góc nhìn mặc định.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#mobile-add-comment',
          popover: {
            title: 'Thêm bình luận',
            description: 'Nhập bình luận cho mô hình.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#mobile-comment-attach-button',
          popover: {
            title: 'Đính kèm',
            description: 'Đính kèm ảnh hoặc file.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '#mobile-comment-link-button',
          popover: {
            title: 'Chèn liên kết',
            description: 'Thêm đường dẫn vào bình luận.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '#mobile-comment-draw-button',
          popover: {
            title: 'Vẽ ghi chú',
            description: 'Vẽ ghi chú trên mô hình.',
            side: 'top',
            align: 'start'
          }
        }
      ]
    } else {
      steps = [
        ...headerSteps,
        {
          element: '#preview-container',
          popover: {
            title: 'Mô hình 3D',
            description: 'Xoay, phóng to và điều chỉnh góc nhìn để xem mô hình.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#model-interaction-mode',
          popover: {
            title: 'Chế độ Tương tác',
            description: 'Chuyển đổi giữa chế độ Xoay (Rotate) và Di chuyển (Pan).',
            side: 'right',
            align: 'center'
          }
        },
        {
          element: '#model-reset-view',
          popover: {
            title: 'Đặt lại góc nhìn',
            description: 'Quay về vị trí camera mặc định.',
            side: 'right',
            align: 'center'
          }
        },
        {
          element: '#model-screenshot',
          popover: {
            title: 'Chụp ảnh',
            description: 'Lưu ảnh chụp màn hình của góc nhìn hiện tại.',
            side: 'right',
            align: 'center'
          }
        },
        {
          element: '.glb-toolbar',
          popover: {
            title: 'Thanh công cụ Chính',
            description: 'Chứa các công cụ điều khiển hiển thị, AR và Animation.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#model-ar-view',
          popover: {
            title: 'Xem AR',
            description: 'Xem mô hình trong không gian thực tế (nếu thiết bị hỗ trợ).',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#model-render-mode',
          popover: {
            title: 'Chế độ hiển thị',
            description: 'Thay đổi giữa Standard, Wireframe hoặc Matcap.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#model-lighting',
          popover: {
            title: 'Cấu hình hiển thị',
            description: 'Điều chỉnh ánh sáng, môi trường và Tone Mapping.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#comments-resize-handle',
          popover: {
            title: 'Thay đổi kích thước khung bình luận',
            description: 'Kéo để thay đổi chiều rộng khung bình luận khi xem mô hình.',
            side: 'left',
            align: 'center'
          }
        },
        commentStep,
        versionToggleStep,
        attachStep,
        linkStep,
        drawStep
      ]
    }
  }

  // Generic fallback
  else {
    steps = [
      {
        element: '#preview-container',
        popover: {
          title: 'Xem và Duyệt',
          description: 'Xem nội dung file và sử dụng các công cụ có sẵn.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#comments-resize-handle',
        popover: {
          title: 'Thay đổi kích thước khung bình luận',
          description: 'Kéo để thay đổi chiều rộng khung bình luận.',
          side: 'left',
          align: 'center'
        }
      },
      commentStep,
      versionToggleStep,
      attachStep,
      linkStep,
      drawStep
    ]
  }

  const driverObj = driver({
    showProgress: true,
    steps: steps,
    onDestroyStarted: () => {
      if (!driverObj.hasNextStep() || confirm('Bạn có muốn dừng hướng dẫn?')) {
        driverObj.destroy()
      }
    },
    onCloseClick: async () => {
      try {
        const ip = await getClientIp()
        if (ip) {
          localStorage.setItem(`hasSeenTour_${fileType}_${ip}`, 'true')
        } else {
          localStorage.setItem(`hasSeenTour_${fileType}`, 'true')
        }
      } catch (e) {
        localStorage.setItem(`hasSeenTour_${fileType}`, 'true')
      }
      driverObj.destroy()
      try {
        document.body.classList.remove('tour-running')
      } catch (e) {
        /* ignore */
      }
    },
    onDestroyed: async () => {
      try {
        const ip = await getClientIp()
        if (ip) {
          localStorage.setItem(`hasSeenTour_${fileType}_${ip}`, 'true')
        } else {
          localStorage.setItem(`hasSeenTour_${fileType}`, 'true')
        }
      } catch (e) {
        localStorage.setItem(`hasSeenTour_${fileType}`, 'true')
      }
      try {
        document.body.classList.remove('tour-running')
      } catch (e) {
        /* ignore */
      }
    }
  })

  // Ensure UI elements that hide on hover (like the 3D toolbar) remain visible during the tour
  try {
    document.body.classList.add('tour-running')
  } catch (e) {
    /* ignore */
  }

  driverObj.drive()
}

/**
 * Check if user has seen the tour for a specific file type
 */
export async function hasSeenTour(fileType: FileType): Promise<boolean> {
  // Try per-IP key first
  try {
    const ip = await getClientIp()
    if (ip) {
      const key = `hasSeenTour_${fileType}_${ip}`
      if (localStorage.getItem(key) === 'true') return true
    }
  } catch (e) {
    // ignore and fallback
  }

  // Backwards-compatible fallback to old key
  return localStorage.getItem(`hasSeenTour_${fileType}`) === 'true'
}

/**
 * Reset tour seen status (useful for debugging or user request)
 */
export function resetTourStatus(fileType?: FileType) {
  if (fileType) {
    // remove generic key
    localStorage.removeItem(`hasSeenTour_${fileType}`)
    // remove any per-ip keys
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(`hasSeenTour_${fileType}_`)) {
        localStorage.removeItem(k)
        // adjust index because we removed an item
        i--
      }
    }
  } else {
    const types: FileType[] = ['image', 'video', 'sequence', 'pdf', 'model']
    types.forEach(type => {
      localStorage.removeItem(`hasSeenTour_${type}`)
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(`hasSeenTour_${type}_`)) {
          localStorage.removeItem(k)
          i--
        }
      }
    })
  }
}
