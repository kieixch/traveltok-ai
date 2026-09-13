/**
 * TravelTok AI — development seed.
 *
 * Populates the database with realistic, deterministic sample data so the
 * dashboard can be developed before Apify/OpenAI are configured.
 *
 * Every record created here is explicitly labeled `isSeedData = true`, so it
 * can be wiped and regenerated at any time (`npm run db:seed`) without ever
 * touching real scraped data.
 */

import "dotenv/config";
import { PrismaService } from "../packages/database/src/prisma.service";
import { ScrapingJobStatus } from "../packages/database/src/generated/enums";

const prisma = new PrismaService();

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — same seed = same data every run.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Vocabulary (Indonesian travel niche, matching the seed project niche).
// ---------------------------------------------------------------------------

const DESTINATIONS = [
  "Bali",
  "Yogyakarta",
  "Malang",
  "Banyuwangi",
  "Bandung",
  "Lombok",
  "Labuan Bajo",
  "Raja Ampat",
  "Bromo",
  "Ijen",
  "Tumpak Sewu",
  "Nusa Penida",
  "Borobudur",
  "Gunung Rinjani",
  "Danau Toba",
  "Sumba",
  "Komodo",
  "Wae Rebo",
  "Dieng",
  "Pulau Weh",
  "Semarang",
  "Medan",
  "Makassar",
];

const TOPICS = [
  "Budget Travel",
  "Hidden Gems",
  "Local Food",
  "Itinerary",
  "Accommodation Review",
  "POV Travel",
  "Travel Tips",
  "Adventure",
  "Beach Vacation",
  "Cultural Trip",
  "Nature Escape",
  "City Break",
  "Street Food",
  "Solo Travel",
  "Family Trip",
];

const HASHTAGS = [
  "wisataindonesia",
  "traveltok",
  "travelindonesia",
  "exploreindonesia",
  "hiddenhiddenplace",
  "wanderlustindonesia",
  "liburanseru",
  "jalanjalan",
  "indonesiatourism",
  "pesonaindonesia",
  "travelvlog",
  "backpackerindonesia",
  "wisataalam",
  "wisatapantai",
  "fypindonesia",
  "ceritabali",
  "gakcumaitu",
  "tempathidden",
  "itinerary",
  "budgettravel",
  "kulineran",
  "pegunungan",
  "islandlife",
  "travelgram",
];

const CREATOR_HANDLES = [
  "travelmaya",
  "kelilingnesia",
  "jalantengah",
  "pantai.kiri",
  "backpacker.rie",
  "travellia",
  "gurih.langka",
  "pulangjongkok",
  "mencatatnesia",
  "liburanbulu",
  "nusantara.walk",
  "kopi.dan.jalan",
  "hiddennesia",
  "gunungmalam",
  "matahari.terbit",
  "rindu.hujan",
  "laut.dan.langit",
  "kemah.minggu",
  "sendal.butut",
  "menu.rute",
  "senggol.travel",
  "pulau.kecil",
  "rute.tersembunyi",
  "bahan.bakar",
  "nyenyak.travel",
];

const MUSIC_POOL = [
  "acoustic travel vlog",
  "indonesian acoustic",
  "upbeat tropical",
  "calm cinematic",
  "sunset chill",
  "morning vibes",
  "traditional gamelan remix",
];

const CAPTION_STYLE_A = [
  "POV: kamu tiba di {dest} pagi-pagi dan langsung disambut langit {color}.",
  "Rahasia {dest} yang jarang ditonton orang. Save dulu buat yang lagi plan ke sini!",
  "3 hari di {dest} habis berapa? Simak breakdown-nya sampai habis.",
  "Jangan ke {dest} sebelum nonton video ini. Ini itinerary 48 jam versi hemat.",
  "Kalau lagi nyari tempat tenang di {dest}, coba spot ini.",
  "Ini bukti kalau {dest} bukan cuma buat backpacker. Semua bisa ke sini.",
  "Aku salah kira tentang {dest}. Ternyata gak se-{expectation} yang dibayangkan.",
  "Dari {dest} aku cuma bawa pulang pengalaman + video ini.",
  "Harga tiket ke {dest} murah banget, cobain sebelum rame.",
  "Nggak nyangka spot hidden gem seindah ini ada di {dest}.",
];

const CAPTION_STYLE_B = [
  "{topic} di {dest} versi 2026 — worth it atau overrated?",
  "Ranking {topic} {dest} dari yang paling underrated sampai paling mainstream.",
  "Gua rekomendasiin {topic} terbaik di {dest} buat kamu yang first time.",
  "{topic} ala local {dest}, bukan yang biasa ada di guidebook.",
  "Budget {topic} ke {dest}: seminggu cuma segini.",
];

const COLORS = ["emas", "biru", "hijau zamrud", "oranye", "ungu senja"];

const EXPECTATIONS = ["ramai", "sulit", "mewah", "jauh", "eksotis"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const pick = <T>(rand: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rand() * arr.length)];

const randInt = (rand: () => number, min: number, max: number): number =>
  Math.floor(rand() * (max - min + 1)) + min;

const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

const DAY = 24 * 60 * 60 * 1000;

function normalizeHashtag(raw: string): string {
  return raw.replace(/^#/, "").toLowerCase().trim();
}

async function main(): Promise<void> {
  console.log("[seed] Starting TravelTok AI seed...");

  // Wipe previous seed data only (never real data).
  await prisma.videoHashtag.deleteMany({});
  await prisma.contentAnalysis.deleteMany({ where: { isSeedData: true } });
  await prisma.videoMetric.deleteMany({ where: { isSeedData: true } });
  await prisma.video.deleteMany({ where: { isSeedData: true } });
  await prisma.creator.deleteMany({ where: { isSeedData: true } });
  await prisma.hashtag.deleteMany({ where: { isSeedData: true } });
  await prisma.scrapingJob.deleteMany({ where: { isSeedData: true } });
  await prisma.contentPlanItem.deleteMany({ where: { isSeedData: true } });
  await prisma.contentPlan.deleteMany({ where: { isSeedData: true } });
  await prisma.contentIdea.deleteMany({ where: { isSeedData: true } });
  await prisma.trend.deleteMany({ where: { isSeedData: true } });
  await prisma.project.deleteMany({ where: { isSeedData: true } });
  await prisma.user.deleteMany({ where: { isSeedData: true } });

  const rand = mulberry32(20260814);
  const now = new Date();
  const seed = { isSeedData: true };

  // --- Users + project ------------------------------------------------------
  const admin = await prisma.user.create({
    data: {
      name: "TravelTok Admin",
      email: "admin@traveltok.local",
      passwordHash:
        "seed-only-no-password", // replaced on real registration (auth phase)
      role: "ADMIN",
      emailVerified: new Date(),
      ...seed,
    },
  });

  const demo = await prisma.user.create({
    data: {
      name: "Demo User",
      email: "demo@traveltok.local",
      passwordHash: "seed-only-no-password",
      role: "USER",
      emailVerified: new Date(),
      ...seed,
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Travel Indonesia",
      description:
        "Seed project covering Indonesian travel creators, destinations and formats for dashboard development.",
      niche: "Travel Indonesia",
      createdById: admin.id,
      ...seed,
    },
  });

  console.log(`[seed] users=${2} project=${project.name}`);

  // --- Hashtags -------------------------------------------------------------
  const hashtagRecords = new Map<string, { id: string; name: string }>();
  for (const name of HASHTAGS) {
    const tag = await prisma.hashtag.create({
      data: { name, normalizedName: normalizeHashtag(name), ...seed },
    });
    hashtagRecords.set(tag.normalizedName, tag);
  }

  // --- Creators -------------------------------------------------------------
  const creators = await Promise.all(
    CREATOR_HANDLES.map((handle, i) =>
      prisma.creator.create({
        data: {
          externalId: `seed-creator-${String(i + 1).padStart(3, "0")}`,
          username: handle,
          displayName: handle
            .split(".")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
          profileUrl: `https://www.tiktok.com/@${handle}`,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(handle)}&background=0b4d3a&color=fff`,
          followers: randInt(rand, 2_000, 4_500_000),
          following: randInt(rand, 50, 2_000),
          totalLikes: BigInt(randInt(rand, 100_000, 120_000_000)),
          videoCount: randInt(rand, 15, 1_200),
          ...seed,
        },
      }),
    ),
  );
  console.log(`[seed] creators=${creators.length}`);

  // --- Videos + metrics + hashtag links -------------------------------------
  let videoCount = 0;
  let metricCount = 0;
  let linkCount = 0;

  for (let v = 0; v < 120; v++) {
    const creator = pick(rand, creators);
    const destination = pick(rand, DESTINATIONS);
    const topic = pick(rand, TOPICS);
    const publishedAt = new Date(now.getTime() - randInt(rand, 1, 120) * DAY);
    const externalId = String(randInt(rand, 1e17, 9.99e17));

    // Engagement tier — most videos average, a few go viral.
    const tier = rand();
    const baseViews =
      tier > 0.97
        ? randInt(rand, 3_000_000, 18_000_000)
        : tier > 0.85
          ? randInt(rand, 400_000, 2_500_000)
          : randInt(rand, 5_000, 380_000);

    const likes = Math.round(baseViews * (0.04 + rand() * 0.06));
    const comments = Math.round(baseViews * (0.002 + rand() * 0.006));
    const shares = Math.round(baseViews * (0.005 + rand() * 0.01));
    const saves = Math.round(baseViews * (0.008 + rand() * 0.02));
    const engagementRate =
      (likes + comments + shares + saves) / baseViews;

    const style = rand() > 0.5 ? CAPTION_STYLE_A : CAPTION_STYLE_B;
    const caption = pick(rand, style)
      .replaceAll("{dest}", destination)
      .replaceAll("{topic}", topic)
      .replaceAll("{color}", pick(rand, COLORS))
      .replaceAll("{expectation}", pick(rand, EXPECTATIONS));

    const video = await prisma.video.create({
      data: {
        externalId,
        creatorId: creator.id,
        projectId: project.id,
        url: `https://www.tiktok.com/@${creator.username}/video/${externalId}`,
        thumbnailUrl: `https://picsum.photos/seed/${externalId}/540/960`,
        caption,
        description: caption,
        duration: randInt(rand, 15, 120),
        publishedAt,
        musicName: pick(rand, MUSIC_POOL),
        location: destination,
        ...seed,
      },
    });

    // Metric snapshot(s) — the "final" one now, plus an earlier one for ~1/6
    // of videos so growth analytics have two data points.
    const collectedAt = clamp(
      publishedAt.getTime() + randInt(rand, 1, 5) * DAY,
      publishedAt.getTime() + DAY,
      now.getTime(),
    );
    const snapshots: Array<{ collectedAt: Date; views: number }> = [];

    if (v % 6 === 0 && publishedAt.getTime() + 2 * DAY < collectedAt) {
      snapshots.push({
        collectedAt: new Date(collectedAt - DAY),
        views: Math.round(baseViews * (0.7 + rand() * 0.2)),
      });
    }
    snapshots.push({ collectedAt: new Date(collectedAt), views: baseViews });

    for (const snap of snapshots) {
      const ratio = snap.views / baseViews;
      await prisma.videoMetric.create({
        data: {
          videoId: video.id,
          views: BigInt(snap.views),
          likes: BigInt(Math.round(likes * ratio)),
          comments: BigInt(Math.round(comments * ratio)),
          shares: BigInt(Math.round(shares * ratio)),
          saves: BigInt(Math.round(saves * ratio)),
          engagementRate,
          collectedAt: snap.collectedAt,
          ...seed,
        },
      });
      metricCount++;
    }

    // Hashtags: 3–6 per video (pool + destination + topic).
    const tagCount = randInt(rand, 3, 6);
    const chosen = new Set<string>([normalizeHashtag(pick(rand, HASHTAGS))]);
    chosen.add(destination.toLowerCase().replaceAll(" ", ""));
    chosen.add(topic.toLowerCase().replaceAll(" ", ""));

    while (chosen.size < tagCount) {
      chosen.add(normalizeHashtag(pick(rand, HASHTAGS)));
    }

    for (const normalized of chosen) {
      let tag = hashtagRecords.get(normalized);
      if (!tag) {
        tag = await prisma.hashtag.create({
          data: { name: `#${normalized}`, normalizedName: normalized, ...seed },
        });
        hashtagRecords.set(normalized, tag);
      }
      await prisma.videoHashtag.create({
        data: { videoId: video.id, hashtagId: tag.id },
      });
      linkCount++;
    }

    videoCount++;
  }

  // A couple of COMPLETED historical scraping jobs for realistic history.
  await prisma.scrapingJob.createMany({
    data: [
      {
        projectId: project.id,
        keyword: "wisata indonesia",
        status: ScrapingJobStatus.COMPLETED,
        totalResults: 120,
        processedResults: 120,
        startedAt: new Date(now.getTime() - 3 * DAY),
        completedAt: new Date(now.getTime() - 2 * DAY),
        ...seed,
      },
      {
        projectId: project.id,
        hashtag: "traveltok",
        status: ScrapingJobStatus.COMPLETED,
        totalResults: 45,
        processedResults: 45,
        startedAt: new Date(now.getTime() - 10 * DAY),
        completedAt: new Date(now.getTime() - 9 * DAY),
        ...seed,
      },
    ],
  });

  console.log(`[seed] videos=${videoCount} metrics=${metricCount} hashtagLinks=${linkCount}`);

  const totals = await prisma.$transaction([
    prisma.user.count(),
    prisma.project.count(),
    prisma.creator.count(),
    prisma.video.count(),
    prisma.videoMetric.count(),
    prisma.hashtag.count(),
    prisma.videoHashtag.count(),
    prisma.scrapingJob.count(),
  ]);

  console.log("[seed] Done. Final counts:", {
    users: totals[0],
    projects: totals[1],
    creators: totals[2],
    videos: totals[3],
    metrics: totals[4],
    hashtags: totals[5],
    videoHashtags: totals[6],
    scrapingJobs: totals[7],
  });
}

main()
  .catch((error) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
