/**
 * Jest 测试环境设置
 * 模拟微信小程序全局对象
 */

// 模拟 wx 全局对象
const mockWx = {
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  getStorage: jest.fn(),
  setStorage: jest.fn(),
  removeStorage: jest.fn(),
  showToast: jest.fn(),
  showModal: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  navigateTo: jest.fn(),
  redirectTo: jest.fn(),
  switchTab: jest.fn(),
  reLaunch: jest.fn(),
  navigateBack: jest.fn(),
  request: jest.fn(),
  login: jest.fn(),
  checkSession: jest.fn(),
  getUserInfo: jest.fn(),
  chooseMedia: jest.fn(),
  chooseLocation: jest.fn(),
  getLocation: jest.fn(),
  downloadFile: jest.fn(),
  createCanvasContext: jest.fn(() => ({
    setFillStyle: jest.fn(),
    setStrokeStyle: jest.fn(),
    setLineWidth: jest.fn(),
    setFontSize: jest.fn(),
    setTextAlign: jest.fn(),
    fillText: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    arcTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    clip: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    draw: jest.fn(),
    drawImage: jest.fn(),
    measureText: jest.fn(() => ({ width: 100 })),
  })),
  canvasToTempFilePath: jest.fn(),
  saveImageToPhotosAlbum: jest.fn(),
  openSetting: jest.fn(),
  previewImage: jest.fn(),
  openLocation: jest.fn(),
  setTabBarBadge: jest.fn(),
  removeTabBarBadge: jest.fn(),
};

// 设置全局 wx 对象
(global as any).wx = mockWx;

// 重置所有 mock
beforeEach(() => {
  jest.clearAllMocks();
});
