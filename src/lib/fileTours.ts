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
export function startFileTour({ fileType, isMobile }: TourOptions) {
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
        {
          element: '#preview-container',
          popover: {
            title: 'Xem hình ảnh',
            description: 'Bạn có thể phóng to, thu nhỏ và di chuyển hình ảnh để xem chi tiết.',
            side: 'bottom',
            align: 'center'
          }
        },
        commentStep
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
            title: 'Xuất Frame',
            description: 'Nhấn vào đây để xuất ảnh PNG của frame hiện tại.',
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
        {
          element: '#comment-attach-button',
          popover: {
            title: 'Đính kèm File',
            description: 'Sử dụng để đính kèm ảnh hoặc file vào bình luận.',
            side: 'left',
            align: 'start'
          }
        },
        {
          element: '#comment-draw-button',
          popover: {
            title: 'Vẽ/Ghi chú',
            description: 'Bật công cụ vẽ để thêm ghi chú trực tiếp lên khung xem trước.',
            side: 'left',
            align: 'start'
          }
        }
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
        {
          element: '#comment-attach-button',
          popover: {
            title: 'Đính kèm File',
            description: 'Đính kèm ảnh hoặc file vào bình luận.',
            side: 'left',
            align: 'start'
          }
        },
        {
          element: '#comment-draw-button',
          popover: {
            title: 'Vẽ/Ghi chú',
            description: 'Mở công cụ vẽ để thêm ghi chú cho frame.',
            side: 'left',
            align: 'start'
          }
        }
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
        {
          element: '#comment-attach-button',
          popover: {
            title: 'Đính kèm File',
            description: 'Đính kèm tài liệu hoặc ảnh vào bình luận.',
            side: 'left',
            align: 'start'
          }
        },
        {
          element: '#comment-draw-button',
          popover: {
            title: 'Vẽ/Ghi chú',
            description: 'Thêm ghi chú trực tiếp lên trang PDF (nếu có công cụ).',
            side: 'left',
            align: 'start'
          }
        }
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
          element: '#model-auto-rotate',
          popover: {
            title: 'Tự động xoay',
            description: 'Bật/tắt tự động xoay mô hình.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#model-render-mode',
          popover: {
            title: 'Chế độ hiển thị',
            description: 'Chuyển đổi chế độ hiển thị mô hình.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#model-screenshot',
          popover: {
            title: 'Chụp ảnh',
            description: 'Lưu ảnh PNG của góc nhìn hiện tại.',
            side: 'bottom',
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
          element: '#mobile-comment-draw-button',
          popover: {
            title: 'Vẽ ghi chú',
            description: 'Vẽ ghi chú để giải thích.',
            side: 'top',
            align: 'start'
          }
        }
      ]
    } else {
      steps = [
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
          element: '#model-auto-rotate',
          popover: {
            title: 'Tự động xoay',
            description: 'Bật/tắt tự động xoay mô hình để xem mọi góc.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#model-render-mode',
          popover: {
            title: 'Chế độ hiển thị',
            description: 'Thay đổi giữa Standard, Wireframe hoặc Matcap để xem vật liệu và cấu trúc mô hình.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#model-camera-selector',
          popover: {
            title: 'Chọn camera (nếu có)',
            description: 'Chọn camera định nghĩa trước trong file GLTF/GLB để nhảy tới góc nhìn đó.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#model-lighting',
          popover: {
            title: 'Điều khiển ánh sáng',
            description: 'Mở bảng điều chỉnh ánh sáng và môi trường để thay đổi cường độ và preset.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#model-bg-light',
          popover: {
            title: 'Nền sáng',
            description: 'Chuyển nền sang sáng để kiểm tra ánh sáng và vật liệu.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#model-bg-dark',
          popover: {
            title: 'Nền tối',
            description: 'Chuyển nền sang tối để kiểm tra phản xạ và độ tương phản.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#model-screenshot',
          popover: {
            title: 'Chụp ảnh',
            description: 'Lưu ảnh PNG của khung nhìn hiện tại để dùng làm thumbnail hoặc tài liệu.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#model-reset',
          popover: {
            title: 'Đặt lại góc nhìn',
            description: 'Phục hồi vị trí camera mặc định và trạng thái xoay.',
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
        {
          element: '#comment-attach-button',
          popover: {
            title: 'Đính kèm File',
            description: 'Đính kèm ảnh hoặc file liên quan tới mô hình.',
            side: 'left',
            align: 'start'
          }
        },
        {
          element: '#comment-draw-button',
          popover: {
            title: 'Vẽ/Ghi chú',
            description: 'Thêm ghi chú để giải thích các phần của mô hình.',
            side: 'left',
            align: 'start'
          }
        }
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
      commentStep
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
    onCloseClick: () => {
      localStorage.setItem(`hasSeenTour_${fileType}`, 'true')
      driverObj.destroy()
      try {
        document.body.classList.remove('tour-running')
      } catch (e) {
        /* ignore */
      }
    },
    onDestroyed: () => {
      localStorage.setItem(`hasSeenTour_${fileType}`, 'true')
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
export function hasSeenTour(fileType: FileType): boolean {
  return localStorage.getItem(`hasSeenTour_${fileType}`) === 'true'
}

/**
 * Reset tour seen status (useful for debugging or user request)
 */
export function resetTourStatus(fileType?: FileType) {
  if (fileType) {
    localStorage.removeItem(`hasSeenTour_${fileType}`)
  } else {
    // Reset all
    const types: FileType[] = ['image', 'video', 'sequence', 'pdf', 'model']
    types.forEach(type => localStorage.removeItem(`hasSeenTour_${type}`))
  }
}
