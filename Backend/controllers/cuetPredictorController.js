const CuetPredictor = require('../models/CuetPredictor');
const cutoffsData = require('../du_cutoffs_round_one.json');

// Build display name: "College Name — Program Name"
function displayName(entry) {
  if (entry.program_name) return `${entry.college_name} — ${entry.program_name}`;
  return entry.college_name;
}

// Normalize a string for fuzzy search — strip all whitespace and lowercase.
function normalizeForSearch(str) {
  return str.toLowerCase().replace(/\s+/g, '');
}

// Resolve the score-based cutoff for a given entry + category.
// Returns null if there's no usable score cutoff for this category.
function getCutoffForEntry(entry, category) {
  const cutoff = entry.cutoffs[category];
  if (cutoff === null || cutoff === undefined) return null;
  return cutoff;
}

// Classify a student's chance against a cutoff.
function chanceFor(score, cutoff) {
  const diff = score - cutoff;
  if (diff >= 10) return 'High';
  if (diff >= 0) return 'Medium';
  if (diff >= -15) return 'Low';
  return null; // out of reach
}

// Returns true if this college is women-only (based on name markers)
function isWomenCollege(entry) {
  return /\(W\)|women|woman/i.test(entry.college_name);
}

// Given a student score, category and gender, return predicted colleges with chance levels
// gender: 'M' = male (exclude women-only), 'F' = female (include all)
function predictColleges(score, category, gender) {
  const results = [];

  for (const entry of cutoffsData) {
    if (gender === 'M' && isWomenCollege(entry)) continue;

    const cutoff = getCutoffForEntry(entry, category);
    if (cutoff === null) continue;

    const chance = chanceFor(score, cutoff);
    if (!chance) continue;

    results.push({
      college_name: displayName(entry),
      cutoffScore: cutoff,
      chance,
    });
  }

  // Sort: High first, then Medium, then Low; within each group by cutoff descending
  const order = { High: 0, Medium: 1, Low: 2 };
  results.sort((a, b) => {
    if (order[a.chance] !== order[b.chance]) return order[a.chance] - order[b.chance];
    return b.cutoffScore - a.cutoffScore;
  });

  return results;
}

// @desc    Submit CUET predictor form — save lead + return predictions
// @route   POST /api/cuet-predictor/submit
// @access  Public
exports.submitPredictor = async (req, res) => {
  try {
    const { name, mobile, score, category, gender } = req.body;

    if (!name || !mobile || score === undefined || score === null || !category) {
      return res.status(400).json({ success: false, message: 'Name, mobile, score, and category are required.' });
    }

    const parsedScore = parseFloat(score);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 800) {
      return res.status(400).json({ success: false, message: 'Score must be a number between 0 and 800.' });
    }

    const validCategories = ['UR', 'OBC', 'SC', 'ST', 'EWS', 'PwBD'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid category.' });
    }

    const validGenders = ['M', 'F'];
    const resolvedGender = validGenders.includes(gender) ? gender : 'F';

    const predictions = predictColleges(parsedScore, category, resolvedGender);

    // Save submission with top 20 predictions as snapshot
    await CuetPredictor.create({
      name: name.trim(),
      mobile: mobile.trim(),
      score: parsedScore,
      category,
      gender: resolvedGender,
      predictedColleges: predictions.slice(0, 20),
    });

    return res.status(200).json({
      success: true,
      predictions,
      total: predictions.length,
    });
  } catch (err) {
    console.error('CUET Predictor submit error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// @desc    Search colleges directly from the cutoff dataset
// @route   GET /api/cuet-predictor/colleges?q=&category=&score=
// @access  Public
exports.searchColleges = async (req, res) => {
  try {
    const rawQ = (req.query.q || '').toString().trim();
    const q = normalizeForSearch(rawQ);
    const category = (req.query.category || 'UR').toString();
    const score = req.query.score !== undefined ? parseFloat(req.query.score) : null;
    const gender = (req.query.gender || 'F').toString();

    const validCategories = ['UR', 'OBC', 'SC', 'ST', 'EWS', 'PwBD'];
    const cat = validCategories.includes(category) ? category : 'UR';

    const matches = [];
    for (const entry of cutoffsData) {
      // Gender filter: males don't see women-only colleges
      if (gender === 'M' && isWomenCollege(entry)) continue;

      const name = displayName(entry);

      // Text filter — whitespace-insensitive match
      if (q && !normalizeForSearch(name).includes(q)) continue;

      const cutoff = getCutoffForEntry(entry, cat);
      if (cutoff === null) continue;

      // Compute chance only if a valid score was supplied
      let chance = null;
      if (score !== null && !isNaN(score)) {
        chance = chanceFor(score, cutoff);
      }

      matches.push({
        college_name: name,
        cutoffScore: cutoff,
        chance,
      });
    }

    // Sort: reachable first (High > Medium > Low > out-of-reach), then by cutoff descending
    const order = { High: 0, Medium: 1, Low: 2 };
    matches.sort((a, b) => {
      const ao = a.chance ? order[a.chance] : 3;
      const bo = b.chance ? order[b.chance] : 3;
      if (ao !== bo) return ao - bo;
      return b.cutoffScore - a.cutoffScore;
    });

    return res.status(200).json({
      success: true,
      results: matches.slice(0, 200),
      total: matches.length,
    });
  } catch (err) {
    console.error('CUET college search error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc    Get all CUET predictor submissions
// @route   GET /api/cuet-predictor/admin/all
// @access  Admin only
exports.getAllSubmissions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      CuetPredictor.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CuetPredictor.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      data: submissions,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('CUET Predictor admin fetch error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
