# Kviz o rybach

Tento projekt pouziva stejnou logiku jako projekt `birds`, jen s daty o rybach.

## Datovy soubor k nahrani

Nahrajte data ryb do souboru:

- `data/fish.csv`

Sloupce v CSV:

1. `imageSrc` - URL obrazku nebo relativni cesta, napr. `images/kapr.jpg`
2. `czechName` - nazev ryby zobrazeny v odpovedich
3. `info` - nepovinny kratky text zobrazeny po odpovedi

Priklad:

```csv
imageSrc,czechName,info
images/kapr.jpg,kapr obecny,Nejbeznejsi ryba v ceskych rybnicich.
```

## Pozadavky

- Alespon 4 radky celkem
- Alespon 4 ruzne nazvy ryb
- Kviz hraje maximalne 15 kol (nebo mene, pokud je v souboru mene ryb)

## Spusteni lokalne

```bash
python3 -m http.server 8000
```

Otevrete [http://localhost:8000](http://localhost:8000).
