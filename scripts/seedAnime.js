const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const animeSchema = new mongoose.Schema({
    shikimori_id: { type: Number, unique: true, index: true },
    title: String,
    poster: String,
    description: String,
    rating: Number,
    year: Number,
    status: String,
    genres: String
});

const Anime = mongoose.model('Anime', animeSchema);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fixMissingPosters() {
    try {
        await connectDB();
        console.log("🔍 Пошук аніме з відсутніми постерами в MongoDB...");

        const missingAnime = await Anime.find({
            $or: [
                { poster: "" },
                { poster: null },
                { poster: { $exists: false } }
            ]
        });

        console.log(`📌 Знайдено тайтлів без постеру: ${missingAnime.length}`);

        if (missingAnime.length === 0) {
            console.log("🎉 Усі аніме в базі вже мають постери!");
            process.exit(0);
        }

        const batchSize = 50;
        let updatedCount = 0;

        for (let i = 0; i < missingAnime.length; i += batchSize) {
            const batch = missingAnime.slice(i, i + batchSize);
            const idsString = batch.map(a => a.shikimori_id).filter(Boolean).join(',');

            if (!idsString) continue;

            const graphqlQuery = {
                query: `
                    query($ids: String) {
                        animes(ids: $ids, limit: 50) {
                            id
                            poster {
                                originalUrl
                                mainUrl
                            }
                        }
                    }
                `,
                variables: { ids: idsString }
            };

            try {
                await sleep(300);

                const res = await fetch('https://shikimori.io/api/graphql', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'NekoStream-Importer/1.0'
                    },
                    body: JSON.stringify(graphqlQuery)
                });

                if (res.status === 429) {
                    console.warn("⚠️ Пауза 5 секунд через ліміт запитів API...");
                    await sleep(5000);
                    i -= batchSize;
                    continue;
                }

                if (!res.ok) {
                    console.error(`🔴 Помилка GraphQL API: ${res.statusText}`);
                    continue;
                }

                const result = await res.json();
                const fetchedAnimes = result?.data?.animes || [];

                for (const item of fetchedAnimes) {
                    const posterObj = item.poster || {};
                    const posterUrl = posterObj.originalUrl || posterObj.mainUrl || '';

                    if (posterUrl && !posterUrl.includes('missing')) {
                        await Anime.updateOne(
                            { shikimori_id: Number(item.id) },
                            { $set: { poster: posterUrl } }
                        );
                        updatedCount++;
                        console.log(`🟢 [Оновлено] ID ${item.id} -> ${posterUrl}`);
                    }
                }

            } catch (err) {
                console.error(`🔴 Помилка пакетної обробки:`, err.message);
            }
        }

        console.log(`🎉 Точкове оновлення через GraphQL завершено! Оновлено постерів: ${updatedCount}`);
        process.exit(0);

    } catch (err) {
        console.error("🔴 Помилка виконання:", err);
        process.exit(1);
    }
}

fixMissingPosters();
