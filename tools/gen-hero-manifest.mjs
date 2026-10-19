// Lista los .fbx de assets/characters/hero/ en manifest.json para hero-lab.html.
// Uso: node tools/gen-hero-manifest.mjs   (vuélvelo a correr cuando agregues animaciones)
import { readdirSync, writeFileSync } from 'node:fs';
const dir = new URL('../assets/characters/hero/', import.meta.url);
const fbx = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.fbx')).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
const character = fbx.find((f) => /^personaje/i.test(f)) || null;
const anims = fbx.filter((f) => f !== character);
// textura del personaje: la primera imagen de la carpeta (el FBX de Tripo la referencia por ruta y no la trae incrustada)
const img = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
const texture = img.find((f) => /color|base|albedo|diffuse/i.test(f)) || img[0] || null;
writeFileSync(new URL('manifest.json', dir), JSON.stringify({ character, texture, anims }, null, 1) + '\n');
console.log(`personaje: ${character} · textura: ${texture || 'NINGUNA'} · animaciones: ${anims.length}`);
