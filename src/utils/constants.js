// 500 MB — matches the spec. Mobile browsers may struggle above this due to
// WASM heap + input/output ArrayBuffer all living in memory simultaneously.
export const FILE_SIZE_WARNING_BYTES = 500 * 1024 * 1024
