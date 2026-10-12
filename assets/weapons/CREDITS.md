# Armas y escudos

Origen: **Medieval Weapons Pack** de Quaternius (https://quaternius.itch.io/lowpoly-medieval-weapons), licencia **CC0 1.0** (dominio público; no exige crédito).
Zip original SHA-256: `546d6e168d71cc3ea0c5d388a7834658619ac2ace8be960050e5fb1dbd344a2a`.

El pack trae OBJ/FBX/Blend, sin GLB. Se convirtieron los OBJ a GLB con un script propio (colores del .mtl, sin texturas),
ya en **metros** y orientados para la mano del personaje:
- Armas: agarre en el origen, hoja hacia +Z (como esperan `equipment.js` y los huesos UAL), filo en ±X.
- Escudos: cara hacia -X (por fuera del antebrazo izquierdo), asa en +X.

En uso: espada=Sword, hacha=Axe, maza=Hammer_Small, rodela=Shield_Round, escudo=Shield_Heater, torre=Shield_Heater_2.
Sin usar todavía (listos para armas nuevas): Sword_2, Sword_Big, Claymore, Dagger, Dagger_2, Axe_Small, Axe_Double, Hammer_Double, Spear, Shield_Round_2.
Si un GLB no carga, `equipment.js` dibuja la forma simple de respaldo.
