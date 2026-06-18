// ADD these lines to your existing src/routes/index.js
// Find the existing routes file and add the kana section

// ── 1. Add this require at the top with other controllers ──────
// const kanaCtrl = require('../controllers/kanaController');

// ── 2. Add this router (with the other routers) ────────────────
// const kanaRouter = express.Router();
// kanaRouter.get('/', kanaCtrl.getAll);          // public — GET /api/kana

// ── 3. Add to admin router (with other admin routes) ───────────
// adminRouter.get   ('/kana',     kanaCtrl.getAll);
// adminRouter.post  ('/kana',     kanaCtrl.create);
// adminRouter.put   ('/kana/:id', kanaCtrl.update);
// adminRouter.delete('/kana/:id', kanaCtrl.remove);

// ── 4. Mount the public kana router ───────────────────────────
// router.use('/kana', kanaRouter);

// ─────────────────────────────────────────────────────────────
// FULL UPDATED routes/index.js (replace your existing file)
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();

const { protect, protectAdmin } = require('../middleware/auth');
const {
  validateSignup, validateLogin, validateForgotPassword,
  validateResetPassword, validateVocab, validateKanji,
  validateGrammar, validateQuiz, validateAnnouncement, validatePreregistration,
} = require('../middleware/validators');

const authCtrl  = require('../controllers/authController');
const vocabCtrl = require('../controllers/vocabularyController');
const kanaCtrl  = require('../controllers/kanaController');
const ctrl      = require('../controllers/mainController');

/* ══════════════════════════════════════════════════════════════
   AUTH  /api/auth
══════════════════════════════════════════════════════════════ */
const authRouter = express.Router();
authRouter.post('/signup',           validateSignup,         authCtrl.signup);
authRouter.post('/login',            validateLogin,          authCtrl.login);
authRouter.post('/admin/login',      validateLogin,          authCtrl.adminLogin);
authRouter.get ('/me',               protect,                authCtrl.getMe);
authRouter.post('/forgot-password',  validateForgotPassword, authCtrl.forgotPassword);
authRouter.patch('/reset-password/:token', validateResetPassword, authCtrl.resetPassword);
authRouter.patch('/update-password', protect,                authCtrl.updatePassword);

/* ══════════════════════════════════════════════════════════════
   VOCABULARY  /api/vocabulary
══════════════════════════════════════════════════════════════ */
const vocabRouter = express.Router();
vocabRouter.get('/',    vocabCtrl.getAll);
vocabRouter.get('/due', protect, vocabCtrl.getDueCards);
vocabRouter.get('/:id', vocabCtrl.getOne);

/* ══════════════════════════════════════════════════════════════
   KANA  /api/kana
══════════════════════════════════════════════════════════════ */
const kanaRouter = express.Router();
kanaRouter.get('/', kanaCtrl.getAll); // public — returns all hiragana + katakana
kanaRouter.get('/progress', protect, kanaCtrl.getProgress);
kanaRouter.get('/session',  protect, kanaCtrl.getSession);
kanaRouter.patch('/progress', protect, kanaCtrl.updateProgress);

/* ══════════════════════════════════════════════════════════════
   KANJI  /api/kanji
══════════════════════════════════════════════════════════════ */
const kanjiRouter = express.Router();
kanjiRouter.get('/',    ctrl.getAllKanji);
kanjiRouter.get('/:id', ctrl.getOneKanji);

/* ══════════════════════════════════════════════════════════════
   GRAMMAR  /api/grammar
══════════════════════════════════════════════════════════════ */
const grammarRouter = express.Router();
grammarRouter.get('/', ctrl.getAllGrammar);

/* ══════════════════════════════════════════════════════════════
   QUIZ  /api/quiz
══════════════════════════════════════════════════════════════ */
const quizRouter = express.Router();
quizRouter.get('/',        ctrl.getQuizForUser);
quizRouter.get('/all',     protect, ctrl.getAllQuiz);
quizRouter.post('/attempt',protect, ctrl.submitQuizAttempt);

/* ══════════════════════════════════════════════════════════════
   PROGRESS  /api/progress
══════════════════════════════════════════════════════════════ */
const progressRouter = express.Router();
progressRouter.use(protect);
progressRouter.get('/',       ctrl.getUserStats);
progressRouter.get('/due',    ctrl.getDueCards);
progressRouter.post('/update',ctrl.updateProgress);

/* ══════════════════════════════════════════════════════════════
   ANNOUNCEMENTS  /api/announcements
══════════════════════════════════════════════════════════════ */
const announcementRouter = express.Router();
announcementRouter.get('/', ctrl.getAnnouncements);

/* ══════════════════════════════════════════════════════════════
   PREREGISTRATION  /api/preregister   PREREGISTRATION  /api/preregister
══════════════════════════════════════════════════════════════ */
const preregisterRouter = express.Router();
preregisterRouter.post('/', validatePreregistration, ctrl.createPreregistration);

/* ══════════════════════════════════════════════════════════════
   ADMIN  /api/admin  (all protected by protectAdmin)
══════════════════════════════════════════════════════════════ */
const adminRouter = express.Router();
adminRouter.use(protectAdmin);

// Stats
adminRouter.get('/stats', ctrl.getAdminStats);

// Vocabulary
adminRouter.get   ('/vocabulary',     vocabCtrl.getAll);
adminRouter.post  ('/vocabulary',     validateVocab, vocabCtrl.create);
adminRouter.put   ('/vocabulary/:id', validateVocab, vocabCtrl.update);
adminRouter.delete('/vocabulary/:id',               vocabCtrl.remove);

// Kana
adminRouter.get   ('/kana',     kanaCtrl.getAll);
adminRouter.post  ('/kana',     kanaCtrl.create);
adminRouter.put   ('/kana/:id', kanaCtrl.update);
adminRouter.delete('/kana/:id', kanaCtrl.remove);

// Kanji
adminRouter.get   ('/kanji',     ctrl.getAllKanji);
adminRouter.post  ('/kanji',     validateKanji,   ctrl.createKanji);
adminRouter.put   ('/kanji/:id', validateKanji,   ctrl.updateKanji);
adminRouter.delete('/kanji/:id',                  ctrl.removeKanji);

// Grammar
adminRouter.get   ('/grammar',     ctrl.getAllGrammar);
adminRouter.post  ('/grammar',     validateGrammar, ctrl.createGrammar);
adminRouter.put   ('/grammar/:id', validateGrammar, ctrl.updateGrammar);
adminRouter.delete('/grammar/:id',                  ctrl.removeGrammar);

// Quiz
adminRouter.get   ('/quiz',     ctrl.getAllQuiz);
adminRouter.post  ('/quiz',     validateQuiz, ctrl.createQuiz);
adminRouter.put   ('/quiz/:id', validateQuiz, ctrl.updateQuiz);
adminRouter.delete('/quiz/:id',               ctrl.removeQuiz);

// Users
adminRouter.get   ('/users',            ctrl.getAllUsers);
adminRouter.get   ('/users/:id',        ctrl.getOneUser);
adminRouter.patch ('/users/:id/status', ctrl.updateUserStatus);
adminRouter.delete('/users/:id',        ctrl.deleteUser);

// Announcements
adminRouter.get   ('/announcements',     ctrl.getAnnouncements);
adminRouter.post  ('/announcements',     validateAnnouncement, ctrl.createAnnouncement);
adminRouter.put   ('/announcements/:id', validateAnnouncement, ctrl.updateAnnouncement);
adminRouter.delete('/announcements/:id',                       ctrl.removeAnnouncement);

/* ── Mount all routers ───────────────────────────────────────── */
router.use('/auth',          authRouter);
router.use('/vocabulary',    vocabRouter);
router.use('/kana',          kanaRouter);
router.use('/kanji',         kanjiRouter);
router.use('/grammar',       grammarRouter);
router.use('/quiz',          quizRouter);
router.use('/progress',      progressRouter);
router.use('/announcements', announcementRouter);
router.use('/preregister',   preregisterRouter);
router.use('/admin',         adminRouter);

module.exports = router;
