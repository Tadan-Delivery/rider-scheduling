# Sistema di pianificazione rider di Tadan

Questo repository contiene il codice sorgente della componente utilizzata in
Tadan per la pianificazione dei turni assegnati ai rider.

Il codice di esempio mostra come le disponibilità indicate dai rider vengano
combinate con le richieste specificate dal Delivery Manager e con i vincoli
contrattuali (minimo di ore garantito) per determinare un assegnamento di turni.

Il codice può essere compilato eseguendo
```bash
npm run build
```

Una volta compilato (e quindi avendo ottenuto un file `build/main.js`),
l'esempio può essere eseguito per esportare il programma lineare corrispondente
ai dati del problema:
```bash
node build/main.js > example.lp
```

Il precedente comando (ri)genera il file `example.lp`, che contiene una codifica
del programma lineare in [formato
LP](https://web.mit.edu/lpsolve/doc/lp-format.htm). Questo è un formato standard
per numerosi strumenti di soluzione di problemi in forma di programma lineare.

Per esempio si può adoperare [`lp_solve`](http://lpsolve.sourceforge.net/5.5/)
per risolvere l'istanza di esempio, ottenendo la soluzione presente nel repository.
```bash
lp_solve example.lp > example.sol
```

All'interno della soluzione la maggior parte delle righe indicano che un
possibile assegnamento *NON* è stato effettuato (ha valore 0); ignorando queste,
si ottiene:

```
# grep -v ' 0' example.sol

Value of objective function: 7706.00000000

Actual values of the variables:
a[0][12..14]                    1
a[0][18..22]                    1
a[1][12..13]                    1
a[1][20..21]                    1
a[2][19..22]                    1
a[3][18..21]                    1
time[0]                         8
time[1]                         4
time[2]                         4
time[3]                         4
```

Le variabili indicano rispettivamente:
 - `a[0][12..14] = 1` al rider #0 è stato assegnato il turno 12-15 (più
   precisamente, un turno che include le ore 12-13, 13-14 e 14-15);
 - `a[0][18..22] = 1` al rider #0 è stato assegnato il turno 18-23;
 - `a[1][12..13] = 1` al rider #1 è stato assegnato il turno 12-14;
 - `a[1][20..21] = 1` al rider #1 è stato assegnato il turno 20-22;
 - `a[2][19..22] = 1` al rider #2 è stato assegnato il turno 19-23;
 - `a[3][18..21] = 1` al rider #3 è stato assegnato il turno 18-22;
 - `time[0] = 8` al rider #0 vanno conteggiate 8 ore lavorative;
 - `time[1] = 4` al rider #1 vanno conteggiate 4 ore lavorative;
 - `time[2] = 4` al rider #2 vanno conteggiate 4 ore lavorative;
 - `time[3] = 4` al rider #3 vanno conteggiate 4 ore lavorative;
