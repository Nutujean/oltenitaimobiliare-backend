import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import { sendEmail } from "../utils/sendEmail.js";
import { makeListingCreationFingerprint } from "../utils/duplicateCheck.js";

const router = express.Router();

// ✅ CONFIG OLX-like
// - FREE: 1 activ / cont + cooldown după expirare
// - PAID: nelimitat
const COOLDOWN_DAYS = 15;

// 🔧 helper normalizare telefon
const normalizePhone = (value = "") => {
  const digits = String(value).replace(/\D/g, "");
  return digits.replace(/^4/, "");
};

/* =======================================================
   🟩 GET toate anunțurile (public)
======================================================= */
router.get("/", async (req, res) => {
  try {
    const sortParam = req.query.sort || "newest";
    const category = (req.query.category || "").trim();
    const location = (req.query.location || "").trim();
    const intent = (req.query.intent || "").trim();
    const q = (req.query.q || "").trim();
    const section = (req.query.section || "").trim();

    let sortQuery = {
      status: 1,
      featured: -1,
      updatedAt: -1,
      createdAt: -1,
    };

    if (sortParam === "cheapest") {
      sortQuery = {
        status: 1,
        featured: -1,
        price: 1,
        createdAt: -1,
      };
    }

    if (sortParam === "expensive") {
      sortQuery = {
        status: 1,
        featured: -1,
        price: -1,
        createdAt: -1,
      };
    }

    if (sortParam === "oldest") {
      sortQuery = {
        status: 1,
        featured: -1,
        createdAt: 1,
      };
    }

    const and = [];

    and.push({
      $or: [
        { visibility: "public" },
        { visibility: { $exists: false } },
      ],
    });

    if (section) {
      and.push({ section });
    } else {
      and.push({
        $or: [
          { section: "imobiliare" },
          { section: { $exists: false } },
        ],
      });
    }

    if (category) and.push({ category });
    if (location) and.push({ location });
    if (intent) and.push({ intent });

    if (q) {
      and.push({
        $or: [
          { title: { $regex: q, $options: "i" } },
          { description: { $regex: q, $options: "i" } },
          { location: { $regex: q, $options: "i" } },
        ],
      });
    }

    const filter = and.length ? { $and: and } : {};
    const now = new Date();

    await Listing.updateMany(
      {
        featured: true,
        featuredUntil: { $lte: now },
      },
      {
        $set: {
          featured: false,
          featuredUntil: null,
        },
      }
    ).exec();

    const listings = await Listing.find(filter)
      .sort(sortQuery)
      .lean()
      .exec();

    return res.json(listings);
  } catch (err) {
    console.error("❌ Eroare GET /api/listings:", err);
    return res.status(500).json({
      error: "Eroare server.",
    });
  }
});

/* =======================================================
   🟦 GET anunțurile mele
======================================================= */
router.get("/mine", protect, async (req, res) => {
  try {
    const listings = await Listing.find({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.json(listings);
  } catch (err) {
    console.error(
      "❌ Eroare GET /api/listings/mine:",
      err
    );

    return res.status(500).json({
      error:
        "Eroare server la încărcarea anunțurilor tale.",
    });
  }
});

/* =======================================================
   🟦 GET un singur anunț
======================================================= */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: "ID invalid.",
      });
    }

    const listing = await Listing.findById(id)
      .lean()
      .exec();

    if (!listing) {
      return res.status(404).json({
        error: "Anunțul nu a fost găsit.",
      });
    }

    return res.json(listing);
  } catch (err) {
    console.error(
      "❌ Eroare GET /api/listings/:id:",
      err
    );

    return res.status(500).json({
      error:
        "Eroare server la încărcarea anunțului.",
    });
  }
});

/* =======================================================
   🟧 POST creare anunț nou
======================================================= */
router.post(
  "/",
  protect,
  upload.array("images", 15),
  async (req, res) => {
    try {
      const {
        title,
        description,
        price,
        category,
        location,
        phone,
        email,
        intent,
        isFree,
        section,
      } = req.body;

      const finalSection = String(
        section || "imobiliare"
      ).trim();

      if (finalSection === "angajari") {
        return res.status(402).json({
          error:
            "Anunțurile de angajări se publică doar după plată (din pagina Angajări).",
          mustPay: true,
        });
      }

      if (
        !title ||
        !description ||
        !price ||
        !category ||
        !location ||
        !phone
      ) {
        return res.status(400).json({
          error:
            "Te rugăm să completezi toate câmpurile obligatorii.",
        });
      }

      const numericPrice = Number(price);

      if (!numericPrice || numericPrice <= 0) {
        return res.status(400).json({
          error:
            "Preț invalid. Trebuie să fie mai mare decât 0.",
        });
      }

      const normalizedPhone =
        normalizePhone(phone);

      const cleanTitle =
        String(title).trim();

      const isFreeListing =
        String(isFree ?? "true") === "true";

      if (!isFreeListing) {
        return res.status(402).json({
          error:
            "Pentru a publica un anunț Promovat trebuie să finalizezi plata.",
          mustPay: true,
        });
      }

      const maxImages =
        isFreeListing ? 10 : 15;

      if (
        req.files &&
        req.files.length > maxImages
      ) {
        return res.status(400).json({
          error:
            "Maxim " +
            maxImages +
            " imagini pentru acest tip de anunț.",
        });
      }

      const dbUser = await User.findById(
        req.user._id
      ).exec();

      if (!dbUser) {
        return res.status(401).json({
          error: "Utilizator inexistent.",
        });
      }

      if (isFreeListing) {
        const activeFree =
          await Listing.findOne({
            user: req.user._id,
            isFree: true,
            expiresAt: {
              $gt: new Date(),
            },
            visibility: "public",
            $or: [
              { section: "imobiliare" },
              {
                section: {
                  $exists: false,
                },
              },
            ],
          }).lean();

        if (activeFree) {
          const daysLeft = Math.ceil(
            (new Date(activeFree.expiresAt) -
              new Date()) /
              (1000 * 60 * 60 * 24)
          );

          return res.status(400).json({
            error:
              "Poți păstra anunțul gratuit existent (mai este valabil ~" +
              daysLeft +
              " zile). Pentru anunțuri suplimentare, salvează ca draft și plătește ca să publici.",
            mustPay: true,
          });
        }

        if (
          dbUser.freeCooldownUntil &&
          new Date(
            dbUser.freeCooldownUntil
          ) > new Date()
        ) {
          const msLeft =
            new Date(
              dbUser.freeCooldownUntil
            ) - new Date();

          const daysLeft = Math.ceil(
            msLeft /
              (1000 * 60 * 60 * 24)
          );

          return res.status(400).json({
            error:
              "Poți publica un nou anunț gratuit peste " +
              daysLeft +
              " zile.",
            mustPay: true,
            cooldownUntil:
              dbUser.freeCooldownUntil,
          });
        }
      }

      let imageUrls = [];

      if (
        req.files &&
        req.files.length > 0
      ) {
        imageUrls = req.files.map(
          (file) =>
            file.path ||
            file.secure_url
        );
      }

      const existingPublic =
        await Listing.findOne({
          user: req.user._id,
          visibility: "public",
          title: cleanTitle,
          phone: normalizedPhone,
          price: numericPrice,
          category,
          location,
          section: "imobiliare",
          expiresAt: {
            $gt: new Date(),
          },
        }).exec();

      if (existingPublic) {
        return res.status(409).json({
          error:
            "Există deja un anunț public similar activ pentru acest cont.",
          existingId:
            existingPublic._id,
        });
      }

      const expiresAt = new Date();
      expiresAt.setDate(
        expiresAt.getDate() + 14
      );

      const listing = new Listing({
        user: req.user._id,
        title: cleanTitle,
        description,
        price: numericPrice,
        category,
        location,
        section: "imobiliare",
        phone: normalizedPhone,
        email,
        intent,
        images: imageUrls,
        visibility: "public",
        isFree: isFreeListing,

        status: "disponibil",
        rezervat: false,
        vandut: false,

        featured: false,
        featuredUntil: null,
        expiresAt,
      });

      listing.createdAt =
        listing.createdAt instanceof Date
          ? listing.createdAt
          : new Date();

      listing.updatedAt =
        new Date();

      await listing.save();

      if (isFreeListing) {
        dbUser.freeCooldownUntil =
          new Date(
            new Date(
              expiresAt
            ).getTime() +
              COOLDOWN_DAYS *
                24 *
                60 *
                60 *
                1000
          );

        await dbUser.save();
      }

      try {
        if (email) {
          await sendEmail({
            to: email,
            subject:
              "Anunț publicat pe OltenitaImobiliare.ro",
            html:
              '<div style="font-family:Arial,sans-serif;line-height:1.6">' +
              "<h2>Anunț publicat cu succes ✅</h2>" +
              "<p>Anunțul tău a fost publicat pe <b>OltenitaImobiliare.ro</b>.</p>" +
              "<p><b>Titlu:</b> " +
              cleanTitle +
              "</p>" +
              "<p><b>Localitate:</b> " +
              location +
              "</p>" +
              "<p><b>Telefon:</b> " +
              normalizedPhone +
              "</p>" +
              "</div>",
          });
        }

        await sendEmail({
          to: "oltenitaimobiliare@gmail.com",
          subject:
            "📩 Anunț nou publicat pe OltenitaImobiliare.ro",
          html:
            '<div style="font-family:Arial,sans-serif;line-height:1.6">' +
            "<h2>Anunț nou ✅</h2>" +
            "<p><b>Titlu:</b> " +
            cleanTitle +
            "</p>" +
            "<p><b>Preț:</b> " +
            numericPrice +
            "</p>" +
            "<p><b>Categorie:</b> " +
            category +
            "</p>" +
            "<p><b>Localitate:</b> " +
            location +
            "</p>" +
            "<p><b>Telefon:</b> " +
            normalizedPhone +
            "</p>" +
            "<p><b>Email utilizator:</b> " +
            (email || "-") +
            "</p>" +
            "<p><b>ID anunț:</b> " +
            listing._id +
            "</p>" +
            "<p><b>Tip:</b> " +
            (isFreeListing
              ? "FREE"
              : "PAID") +
            "</p>" +
            "</div>",
        });
      } catch (e) {
        console.error(
          "❌ Eroare trimitere email la publicare:",
          e?.message || e
        );
      }

      return res.status(201).json(
        listing
      );
    } catch (err) {
      console.error(
        "❌ Eroare POST /api/listings:",
        err
      );

      return res.status(500).json({
        error:
          "Eroare server la adăugarea anunțului.",
      });
    }
  }
);

/* =======================================================
   🟨 POST salvare DRAFT
======================================================= */
router.post(
  "/draft",
  protect,
  upload.array("images", 15),
  async (req, res) => {
    try {
      const {
        title,
        description,
        price,
        category,
        location,
        phone,
        email,
        intent,
        section,
      } = req.body;

      if (
        !title ||
        !description ||
        !price ||
        !category ||
        !location ||
        !phone
      ) {
        return res.status(400).json({
          error:
            "Completează toate câmpurile obligatorii.",
        });
      }

      const numericPrice =
        Number(price);

      if (
        !numericPrice ||
        numericPrice <= 0
      ) {
        return res.status(400).json({
          error: "Preț invalid.",
        });
      }

      const normalizedPhone =
        normalizePhone(phone);

      const cleanTitle =
        String(title).trim();

      if (
        req.files &&
        req.files.length > 15
      ) {
        return res.status(400).json({
          error:
            "Maxim 15 imagini pentru draft.",
        });
      }

      let imageUrls = [];

      if (
        req.files &&
        req.files.length > 0
      ) {
        imageUrls = req.files.map(
          (file) =>
            file.path ||
            file.secure_url
        );
      }

      const finalSection =
        section === "angajari"
          ? "angajari"
          : "imobiliare";

      const submissionKey = String(req.body.submissionKey || "").trim();
      if (submissionKey.length > 120) {
        return res.status(400).json({ error: "Cheie de publicare invalidă." });
      }

      const creationFingerprint = makeListingCreationFingerprint({
        userId: req.user._id,
        phone: normalizedPhone,
        title: cleanTitle,
        description,
        price: numericPrice,
        category,
        location,
        intent,
        section: finalSection,
      });

      const duplicateQuery = submissionKey
        ? { $or: [{ submissionKey }, { creationFingerprint }] }
        : { creationFingerprint };

      const previousSubmission = await Listing.findOne({
        user: req.user._id,
        ...duplicateQuery,
      }).lean();
      if (previousSubmission) {
        if (previousSubmission.visibility !== "draft") {
          return res.status(409).json({
            error: "Acest anunț este deja publicat. Editează-l sau promovează-l pe cel existent.",
            existingId: previousSubmission._id,
            duplicate: true,
          });
        }
        return res.status(200).json({
          ok: true,
          draftId: previousSubmission._id,
          message: "Draftul există deja.",
        });
      }

      const existingDraft =
        await Listing.findOne({
          user: req.user._id,
          visibility: "draft",
          title: cleanTitle,
          phone: normalizedPhone,
          price: numericPrice,
          category,
          location,
          section: finalSection,
        }).exec();

      if (existingDraft) {
        existingDraft.description =
          description;

        existingDraft.email =
          email;

        existingDraft.intent =
          intent;

        if (imageUrls.length > 0) {
          existingDraft.images =
            imageUrls;
        }

        await existingDraft.save();

        return res.status(200).json({
          ok: true,
          draftId:
            existingDraft._id,
          message:
            "Draft actualizat.",
        });
      }

      const draft = new Listing({
        user: req.user._id,
        title: cleanTitle,
        description,
        price: numericPrice,
        category,
        location,
        section: finalSection,
        phone: normalizedPhone,
        email,
        intent,
        images: imageUrls,
        submissionKey: submissionKey || undefined,
        creationFingerprint,
        visibility: "draft",
        isFree: false,
        expiresAt: null,

        featured: false,
        featuredUntil: null,

        status: "disponibil",
        rezervat: false,
        vandut: false,
      });

      try {
        await draft.save();
      } catch (error) {
        if (error?.code === 11000) {
          const saved = await Listing.findOne({
            user: req.user._id,
            ...duplicateQuery,
          }).lean();
          if (saved?.visibility === "draft") {
            return res.status(200).json({
              ok: true,
              draftId: saved._id,
              message: "Draftul există deja.",
            });
          }
          if (saved) {
            return res.status(409).json({
              error: "Acest anunț este deja publicat.",
              existingId: saved._id,
              duplicate: true,
            });
          }
        }
        throw error;
      }

      return res.status(201).json({
        ok: true,
        draftId: draft._id,
        message: "Draft salvat.",
      });
    } catch (err) {
      console.error(
        "❌ Eroare POST /api/listings/draft:",
        err
      );

      return res.status(500).json({
        error:
          "Eroare server la salvarea draftului.",
      });
    }
  }
);

/* =======================================================
   🟩 PUT reactivare gratuită
======================================================= */
router.put(
  "/:id/reactivate",
  protect,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (
        !mongoose.isValidObjectId(id)
      ) {
        return res.status(400).json({
          error: "ID invalid.",
        });
      }

      const listing =
        await Listing.findById(id).exec();

      if (!listing) {
        return res.status(404).json({
          error:
            "Anunțul nu a fost găsit.",
        });
      }

      if (
        listing.user &&
        listing.user.toString() !==
          req.user._id.toString()
      ) {
        return res.status(403).json({
          error:
            "Nu ai dreptul să reactivezi acest anunț.",
        });
      }

      if (!listing.expiresAt) {
        return res.status(400).json({
          error:
            "Anunțul nu are dată de expirare.",
        });
      }

      const now = new Date();

      const expiredAt = new Date(
        listing.expiresAt
      );

      const daysSinceExpired =
        Math.floor(
          (now - expiredAt) /
            (1000 * 60 * 60 * 24)
        );

      if (daysSinceExpired < 30) {
        return res.status(400).json({
          error:
            "Acest anunț poate fi reactivat gratuit doar după 30 zile de la expirare. Până atunci, trebuie promovat.",
          mustPromote: true,
        });
      }

      const newExpiresAt =
        new Date();

      newExpiresAt.setDate(
        newExpiresAt.getDate() + 14
      );

      const updated =
        await Listing.findByIdAndUpdate(
          id,
          {
            $set: {
              status:
                "disponibil",
              visibility: "public",
              isFree: true,

              rezervat: false,
              vandut: false,

              featured: false,
              featuredUntil: null,
              expiresAt:
                newExpiresAt,
              updatedAt:
                new Date(),
            },
          },
          {
            new: true,
          }
        ).lean();

      return res.json({
        ok: true,
        message:
          "Anunțul a fost reactivat gratuit pentru 14 zile.",
        listing: updated,
      });
    } catch (err) {
      console.error(
        "❌ Eroare PUT /api/listings/:id/reactivate:",
        err
      );

      return res.status(500).json({
        error:
          "Eroare server la reactivare.",
      });
    }
  }
);

/* =======================================================
   🟦 PUT stare proprietate
   DISPONIBIL / REZERVAT / VÂNDUT

   IMPORTANT:
   Folosim direct MongoDB collection, NU listing.save().
   Astfel funcționează și pentru anunțurile vechi care au
   createdAt / alte date salvate într-un format vechi.
======================================================= */
router.put(
  "/:id/property-status",
  protect,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Verificare ID
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          error: "ID invalid.",
        });
      }

      // Starea cerută din frontend
      const propertyStatus = String(
        req.body?.propertyStatus || ""
      )
        .toLowerCase()
        .trim();

      const allowedStatuses = [
        "disponibil",
        "rezervat",
        "vandut",
      ];

      if (!allowedStatuses.includes(propertyStatus)) {
        return res.status(400).json({
          error: "Stare proprietate invalidă.",
        });
      }

      const objectId = new mongoose.Types.ObjectId(id);

      // =====================================================
      // CITIRE DIRECT DIN MONGODB
      // Nu hidratăm documentul prin Mongoose.
      // Astfel createdAt vechi/greșit nu mai produce CastError.
      // =====================================================
      const listing = await Listing.collection.findOne(
        { _id: objectId },
        {
          projection: {
            _id: 1,
            user: 1,
            visibility: 1,
            status: 1,
            expiresAt: 1,
            rezervat: 1,
            vandut: 1,
          },
        }
      );

      if (!listing) {
        return res.status(404).json({
          error: "Anunțul nu a fost găsit.",
        });
      }

      // =====================================================
      // VERIFICĂM PROPRIETARUL
      // =====================================================
      if (
        !listing.user ||
        String(listing.user) !== String(req.user._id)
      ) {
        return res.status(403).json({
          error: "Nu ai dreptul să modifici acest anunț.",
        });
      }

      // Draftul nu poate fi rezervat/vândut
      if (listing.visibility === "draft") {
        return res.status(400).json({
          error: "Publică mai întâi anunțul.",
        });
      }

      // =====================================================
      // VERIFICĂM EXPIRAREA
      // =====================================================
      let expiredByDate = false;

      if (listing.expiresAt) {
        let expiresValue = listing.expiresAt;

        // Compatibilitate cu documente vechi:
        // expiresAt: { $date: "..." }
        if (
          typeof expiresValue === "object" &&
          !(expiresValue instanceof Date) &&
          expiresValue.$date
        ) {
          expiresValue = expiresValue.$date;
        }

        const expiresDate = new Date(expiresValue);

        if (!Number.isNaN(expiresDate.getTime())) {
          expiredByDate =
            expiresDate.getTime() < Date.now();
        }
      }

      if (
        String(listing.status || "").toLowerCase() === "expirat" ||
        expiredByDate
      ) {
        return res.status(400).json({
          error:
            "Anunțul este expirat. Reactivează-l mai întâi.",
        });
      }

      // =====================================================
      // STABILIM VALORILE
      // =====================================================
      let rezervat = false;
      let vandut = false;

      if (propertyStatus === "rezervat") {
        rezervat = true;
        vandut = false;
      }

      if (propertyStatus === "vandut") {
        rezervat = false;
        vandut = true;
      }

      if (propertyStatus === "disponibil") {
        rezervat = false;
        vandut = false;
      }

      // =====================================================
      // UPDATE DIRECT ÎN MONGODB
      //
      // Foarte important:
      // NU folosim listing.save().
      // Modificăm strict cele 3 câmpuri de mai jos.
      // createdAt rămâne neatins.
      // =====================================================
      const result = await Listing.collection.updateOne(
        {
          _id: objectId,
          user: listing.user,
        },
        {
          $set: {
            rezervat,
            vandut,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          error:
            "Anunțul nu a mai putut fi găsit pentru actualizare.",
        });
      }

      // =====================================================
      // CITIM DOCUMENTUL ACTUALIZAT TOT DIRECT DIN MONGO
      // =====================================================
      const updatedListing =
        await Listing.collection.findOne({
          _id: objectId,
        });

      let message =
        "Anunțul a fost marcat DISPONIBIL.";

      if (propertyStatus === "rezervat") {
        message =
          "Anunțul a fost marcat REZERVAT.";
      }

      if (propertyStatus === "vandut") {
        message =
          "Anunțul a fost marcat VÂNDUT.";
      }

      return res.json({
        ok: true,
        propertyStatus,
        rezervat,
        vandut,
        message,
        listing: updatedListing,
      });
    } catch (err) {
      console.error(
        "❌ Eroare PUT /api/listings/:id/property-status:",
        err
      );

      return res.status(500).json({
        error:
          "Eroare server la actualizarea stării proprietății.",
      });
    }
  }
);

/* =======================================================
   🟧 PUT actualizare anunț
======================================================= */
router.put(
  "/:id",
  protect,
  upload.array("images", 15),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (
        !mongoose.isValidObjectId(id)
      ) {
        return res.status(400).json({
          error: "ID invalid.",
        });
      }

      const listing =
        await Listing.findById(id).exec();

      if (!listing) {
        return res.status(404).json({
          error:
            "Anunțul nu a fost găsit.",
        });
      }

      if (
        listing.user &&
        listing.user.toString() !==
          req.user._id.toString()
      ) {
        return res.status(403).json({
          error:
            "Nu ai dreptul să modifici acest anunț.",
        });
      }

      const {
        title,
        description,
        price,
        category,
        location,
        phone,
        email,
        intent,
        type,
      } = req.body;

      const finalIntent =
        type ?? intent;

      const t = String(
        title ??
          listing.title ??
          ""
      ).trim();

      const c = String(
        category ??
          listing.category ??
          ""
      ).trim();

      const loc = String(
        location ??
          listing.location ??
          ""
      ).trim();

      const ph =
        normalizePhone(
          phone ??
            listing.phone ??
            ""
        );

      const it = String(
        finalIntent ??
          listing.intent ??
          ""
      ).trim();

      if (
        !t ||
        !c ||
        !loc ||
        !ph ||
        !it
      ) {
        return res.status(400).json({
          error:
            "Completează obligatoriu: Titlu, Categorie, Tip (Vând/Cumpăr/Închiriez/Schimb), Localitate, Telefon.",
        });
      }

      if (ph.length < 9) {
        return res.status(400).json({
          error:
            "Număr de telefon invalid.",
        });
      }

      const maxImages =
        listing.isFree ? 10 : 15;

      const existingImagesRaw =
        req.body.existingImages ??
        [];

      const existingImages =
        Array.isArray(
          existingImagesRaw
        )
          ? existingImagesRaw.filter(
              Boolean
            )
          : [
              existingImagesRaw,
            ].filter(Boolean);

      const uploadedCount =
        (req.files || []).length;

      const total =
        existingImages.length +
        uploadedCount;

      if (total > maxImages) {
        return res.status(400).json({
          error:
            "Maxim " +
            maxImages +
            " imagini pentru acest tip de anunț.",
        });
      }

      if (title !== undefined) {
        listing.title = title;
      }

      if (
        description !== undefined
      ) {
        listing.description =
          description;
      }

      if (price !== undefined) {
        listing.price =
          Number(price);
      }

      if (
        category !== undefined
      ) {
        listing.category =
          category;
      }

      if (
        location !== undefined
      ) {
        listing.location =
          location;
      }

      if (phone !== undefined) {
        listing.phone = ph;
      }

      if (email !== undefined) {
        listing.email = email;
      }

      if (
        finalIntent !== undefined
      ) {
        listing.intent =
          finalIntent;
      }

      const existing = []
        .concat(
          req.body
            .existingImages || []
        )
        .filter(Boolean);

      const uploadedImages =
        (req.files || [])
          .map(
            (file) =>
              file.path ||
              file.secure_url
          )
          .filter(Boolean);

      const combined = [
        ...existing,
        ...uploadedImages,
      ];

      if (
        combined.length > 0
      ) {
        listing.images =
          combined;
      }

      const safeDate = (d) => {
        if (!d) return null;

        if (d instanceof Date) {
          return d;
        }

        if (
          typeof d ===
            "string" ||
          typeof d === "number"
        ) {
          const parsed =
            new Date(d);

          return Number.isNaN(
            parsed.getTime()
          )
            ? null
            : parsed;
        }

        if (
          typeof d ===
            "object" &&
          d.$date
        ) {
          const parsed =
            new Date(d.$date);

          return Number.isNaN(
            parsed.getTime()
          )
            ? null
            : parsed;
        }

        return null;
      };

      listing.featuredUntil =
        safeDate(
          listing.featuredUntil
        );

      listing.expiresAt =
        safeDate(
          listing.expiresAt
        ) ||
        new Date(
          Date.now() +
            14 *
              24 *
              60 *
              60 *
              1000
        );

      listing.createdAt =
        safeDate(
          listing.createdAt
        ) || new Date();

      await listing.save();

      return res.json(listing);
    } catch (err) {
      console.error(
        "❌ Eroare PUT /api/listings/:id:",
        err
      );

      return res.status(500).json({
        error:
          "Eroare server la actualizarea anunțului.",
      });
    }
  }
);

/* =======================================================
   🟩 PUT publicare DRAFT după plată
======================================================= */
router.put(
  "/:id/publish",
  protect,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (
        !mongoose.isValidObjectId(id)
      ) {
        return res.status(400).json({
          error: "ID invalid.",
        });
      }

      const listing =
        await Listing.findById(id).exec();

      if (!listing) {
        return res.status(404).json({
          error:
            "Anunțul nu a fost găsit.",
        });
      }

      if (
        listing.user &&
        listing.user.toString() !==
          req.user._id.toString()
      ) {
        return res.status(403).json({
          error:
            "Nu ai dreptul să publici acest anunț.",
        });
      }

      if (
        listing.visibility !==
        "draft"
      ) {
        return res.status(400).json({
          error:
            "Acest anunț nu este draft.",
        });
      }

      listing.visibility =
        "public";

      listing.isFree = false;

      listing.status =
        "disponibil";

      listing.rezervat = false;
      listing.vandut = false;

      const expiresAt =
        new Date();

      expiresAt.setDate(
        expiresAt.getDate() + 30
      );

      listing.expiresAt =
        expiresAt;

      if (!listing.section) {
        listing.section =
          "imobiliare";
      }

      await listing.save();

      try {
        if (listing.email) {
          await sendEmail({
            to: listing.email,
            subject:
              "Anunț publicat pe OltenitaImobiliare.ro",
            html:
              '<div style="font-family:Arial,sans-serif;line-height:1.6">' +
              "<h2>Anunț publicat cu succes ✅</h2>" +
              "<p>Anunțul tău a fost publicat pe <b>OltenitaImobiliare.ro</b>.</p>" +
              "<p><b>Titlu:</b> " +
              listing.title +
              "</p>" +
              "<p><b>Localitate:</b> " +
              listing.location +
              "</p>" +
              "<p><b>Telefon:</b> " +
              listing.phone +
              "</p>" +
              "</div>",
          });
        }

        await sendEmail({
          to:
            "oltenitaimobiliare@gmail.com",
          subject:
            "💳 Anunț publicat după plată (Promovat) - OltenitaImobiliare.ro",
          html:
            '<div style="font-family:Arial,sans-serif;line-height:1.6">' +
            "<h2>Anunț publicat după plată ✅</h2>" +
            "<p><b>Titlu:</b> " +
            listing.title +
            "</p>" +
            "<p><b>Preț:</b> " +
            listing.price +
            "</p>" +
            "<p><b>Categorie:</b> " +
            listing.category +
            "</p>" +
            "<p><b>Localitate:</b> " +
            listing.location +
            "</p>" +
            "<p><b>Telefon:</b> " +
            listing.phone +
            "</p>" +
            "<p><b>Email utilizator:</b> " +
            (listing.email || "-") +
            "</p>" +
            "<p><b>ID anunț:</b> " +
            listing._id +
            "</p>" +
            "<p><b>Tip:</b> PAID / PROMOVAT</p>" +
            "</div>",
        });
      } catch (e) {
        console.error(
          "❌ Eroare trimitere email la publish:",
          e?.message || e
        );
      }

      return res.json({
        ok: true,
        listing,
      });
    } catch (err) {
      console.error(
        "❌ Eroare PUT /api/listings/:id/publish:",
        err
      );

      return res.status(500).json({
        error:
          "Eroare server la publicare.",
      });
    }
  }
);

/* =======================================================
   🟥 DELETE ștergere anunț
======================================================= */
router.delete(
  "/:id",
  protect,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (
        !mongoose.isValidObjectId(id)
      ) {
        return res.status(400).json({
          error: "ID invalid.",
        });
      }

      const listing =
        await Listing.findById(id).exec();

      if (!listing) {
        return res.status(404).json({
          error:
            "Anunțul nu a fost găsit.",
        });
      }

      if (
        listing.user &&
        listing.user.toString() !==
          req.user._id.toString()
      ) {
        return res.status(403).json({
          error:
            "Nu ai dreptul să ștergi acest anunț.",
        });
      }

      await listing.deleteOne();

      return res.json({
        success: true,
        message:
          "Anunț șters cu succes.",
      });
    } catch (err) {
      console.error(
        "❌ Eroare DELETE /api/listings/:id:",
        err
      );

      return res.status(500).json({
        error:
          "Eroare server la ștergerea anunțului.",
      });
    }
  }
);

export default router;