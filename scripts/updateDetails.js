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

const Anime = mongoose.models.Anime || mongoose.model('Anime', animeSchema);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function updateAnimeDetailsFromShikimori() {
    try {
        await connectDB();
        console.log("🔍 Пошук аніме без опису або жанрів в MongoDB...");

        const targetAnime = await Anime.find({
            $or: [
                { description: { $regex: /Опис доступний/i } },
                { description: "" },
                { description: null },
                { genres: "TV" },
                { genres: "" },
                { genres: null }
            ]
        });

        console.log(`📌 Знайдено тайтлів для оновлення: ${targetAnime.length}`);

        if (targetAnime.length === 0) {
            console.log("🎉 Усі аніме в базі вже мають описи та жанри!");
            process.exit(0);
        }

        const batchSize = 50;
        let updatedCount = 0;

        for (let i = 0; i < targetAnime.length; i += batchSize) {
            const batch = targetAnime.slice(i, i + batchSize);
            const idsString = batch.map(a => a.shikimori_id).filter(Boolean).join(',');

            if (!idsString) continue;

            const graphqlQuery = {
                query: `
                    query($ids: String) {
                        animes(ids: $ids, limit: 50) {
                            id
                            description
                            genres {
                                name
                                russian
                            }
                        }
                    }
                `,
                variables: { ids: idsString }
            };

            try {
                await sleep(500);

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
                    const cleanDesc = item.description 
                        ? item.description.replace(/\[.*?\]/g, '').replace(/<.*?>/g, '').trim() 
                        : '';

                    const genresList = Array.isArray(item.genres) && item.genres.length > 0
                        ? item.genres.map(g => g.russian || g.name).join(', ')
                        : '';

                    const updateData = {};
                    if (cleanDesc) updateData.description = cleanDesc;
                    if (genresList) updateData.genres = genresList;

                    if (Object.keys(updateData).length > 0) {
                        await Anime.updateOne(
                            { shikimori_id: Number(item.id) },
                            { $set: updateData }
                        );
                        updatedCount++;
                        console.log(`🟢 [Оновлено] ID ${item.id}`);
                    }
                }

            } catch (err) {
                console.error(`🔴 Помилка пакетної обробки:`, err.message);
            }
        }

        console.log(`🎉 Заповнення описів та жанрів завершено! Оновлено: ${updatedCount}`);
        process.exit(0);

    } catch (err) {
        console.error("🔴 Помилка виконання:", err);
        process.exit(1);
    }
}

updateAnimeDetailsFromShikimori();