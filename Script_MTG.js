const fs = require('fs');

let lastLoadedCard = "NONE";

function countCost(str) {
    if (!str) return 0;
    const matches = str.match(/\{([^}]+)\}/g);
    if (!matches) return 0;
    return matches.reduce((sum, token) => {
        const content = token.slice(1, -1);
        if (!isNaN(content)) return sum + parseInt(content, 10);
        if (content === 'X') return sum;
        return sum + 1;
    }, 0);
}

function getCardType(typeLine, setType, name) {
    const t = typeLine.toLowerCase();
    if (t.includes("battle")) return "Battle";
    if (t.includes("creature")) return "Creature";
    if (t.includes("land") && !t.includes("lander")) return "Land";
    if (t.includes("artifact")) return "Artifact";
    if (t.includes("enchantment — aura")) return "Enchantment - Aura";
    if (t.includes("enchantment")) return "Enchantment";
    if (t.includes("instant")) return "Instant";
    if (t.includes("sorcery")) return "Sorcery";
    if (t.includes("planeswalker")) return "Planeswalker";
    if (t.includes("emblem")) return "Emblem";
    if (t.includes("card") && !setType.includes("memorabilia") && !setType.includes("minigame") && !name.includes("Checklist")) return "Card";
    return "Other";
}

function getImages(c) {
    let colors = [], image = {};
    if (c.card_faces && c.card_faces[0].image_uris) {
        image.front = c.card_faces[0].image_uris.normal;
        image.back = c.card_faces[1].image_uris.normal;
        colors = [...c.card_faces[0].colors];
        c.card_faces[1].colors.forEach(color => {
            if (!colors.includes(color)) colors.push(color);
        });
    } else {
        image.front = c.image_uris.normal;
        colors = c.colors;
    }
    return { image, colors };
}

function getPowerToughness(value) {
    if (!value || /[+\-.*?∞]/.test(value)) return 0;
    return Math.trunc(value);
}

function modifyJsonFile(inputFilePath, outputFilePath, allCardsPath) {
    fs.readFile(inputFilePath, 'utf8', (err, data) => {
        if (err) return console.error('Erreur lecture input JSON:', err);

        fs.readFile(allCardsPath, 'utf8', (err, allData) => {
            if (err) return console.error('Erreur lecture allCards JSON:', err);

            const allCards = {};
            JSON.parse(allData).forEach(d => allCards[d.id] = d.oracle_id);

            try {
                const jsonObject = JSON.parse(data);
                const result = {};

                jsonObject.forEach(c => {
                    lastLoadedCard = c;
                    const { image, colors } = getImages(c);
                    const type = getCardType(c.type_line, c.set_type, c.name);
                    const cost = c.cmc ? Math.trunc(c.cmc) : 0
                    const newCard = {
                        id: c.oracle_id,
                        name: c.name,
                        type,
                        face: {
                            front: {
                                name: c.name,
                                type,
                                cost: cost,
                                isHorizontal: c.layout == "split" || type == "Battle",
                                image: image.front
                            }
                        },
                        Colors: colors,
                        "Card type": c.type_line,
                        "Color identity": c.color_identity,
                        set: c.set,
                        isHorizontal: c.layout == "split" || type == "Battle",
                        cost: cost
                    };

                    if (c.power) newCard.power = getPowerToughness(c.power);
                    if (c.toughness) newCard.toughness = getPowerToughness(c.toughness);

                    // Gestion des cartes split/back
                    if (c.card_faces) {
                        const splitType = c.type_line.split(' // ');
                        const splitName = c.name.split(' // ');

                        const typeFront = getCardType(splitType[0], c.set_type, c.name);
                        newCard.face = {
                            front: {
                                name: splitName[0],
                                type: typeFront,
                                cost: Math.trunc(countCost(c.card_faces[0].mana_cost)),
                                isHorizontal: typeFront == "Battle",
                                image: image.front
                            }
                        };

                        if (c.card_faces.length === 2 && splitType.length === 2 && splitName.length === 2 && image.back) {
                            const typeBack = getCardType(splitType[1], c.set_type, c.name);
                            newCard.face.back = {
                                name: splitName[1],
                                type: typeBack,
                                cost: Math.trunc(countCost(c.card_faces[1].mana_cost)),
                                isHorizontal: typeBack == "Battle",
                                image: image.back
                            };
                        }

                        if (c.layout == "split" || c.layout == "adventure") {
                            newCard.face.front.isHorizontal = !(c.keywords.includes("Aftermath") || c.layout == "adventure")
                            //cost: Math.trunc(c.cmc),
                        }
                    }

                    if (c.type_line.includes("oken") || c.set_type === "token" || type === "Emblem" || type === "Card") {
                        newCard.isToken = true;
                    }

                    // Tokens liés
                    if (c.all_parts) {
                        const tokens = c.all_parts
                            .filter(p => p.component === "token" && allCards[p.id])
                            .map(p => allCards[p.id]);
                        if (tokens.length) newCard.tokens = tokens;
                    }

                    if (type != "Other" && c.layout != "art_series" && !c.name.includes(" // Wanted!")) {
                        result[c.oracle_id] = newCard;
                    }
                });

                fs.writeFile(outputFilePath, JSON.stringify(result, null, 2), 'utf8', (err) => {
                    if (err) console.error('Erreur écriture output JSON:', err);
                    else console.log(`Fichier sauvegardé: ${outputFilePath}, total cartes: ${Object.keys(result).length}`);
                });
            } catch (e) {
                console.log(lastLoadedCard);
                console.error('Erreur traitement JSON:', e);
            }
        });
    });
}

// Utilisation
//modifyJsonFile('oracle.json', 'MTGCards.json', 'all.json');
module.exports = modifyJsonFile;
