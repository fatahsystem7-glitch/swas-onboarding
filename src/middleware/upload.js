import multer from 'multer';

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per document

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

// Keep files in memory so we can stream them straight to Telnyx Documents API.
const storage = multer.memoryStorage();

export const uploadOnboardingDocs = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 2 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Use JPG, PNG, WEBP or PDF.`));
      return;
    }
    cb(null, true);
  },
}).fields([
  { name: 'proof_of_id', maxCount: 1 },
  { name: 'proof_of_address', maxCount: 1 },
]);
