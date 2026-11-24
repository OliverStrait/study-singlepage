# Viikkokello

Paikallinen työajanseuranta, joka toimii selaimessa ilman palvelinta tai asennettavia riippuvuuksia.

## Käyttö

1. Käynnistä paikallinen palvelin projektikansiosta: Windowsissa suorita `start-local-server.bat`, Linuxissa `bash start-local-server.sh`. Avaa sitten selaimessa `http://localhost:8000`. Palvelimen voi pysäyttää näppäinyhdistelmällä Ctrl+C.
2. Valitse profiili headerista tai luo **Uusi profiili** -painikkeella. Profiilin vieressä olevalla värivalitsimella voit muuttaa sen header-sävyä. Aiemmat tehtävät ja asetukset siirtyvät **Työ**-profiiliin.
3. Aseta työpäivän alku ja loppu sekä päivittäinen taukoaika kohdasta **Työaika-asetukset**. Asetukset ovat profiilikohtaisia ja taukoaika vähennetään päivä- ja viikkotavoitteesta.
4. Kirjoita tehtävän nimi ja aloita ajanotto. Lopeta käynnissä oleva tehtävä ennen profiilin vaihtamista; aloita ja lopeta tauot tehtävän omasta painikkeesta.
5. Avaa päivän **Tiedot**-painikkeesta aloitusajan mukaan järjestetty, tasavälinen tehtävälista taukoerittelyineen sekä päivän työtunti- ja tavoitetilastot.
6. Selaa viikkoja nuolipainikkeilla. Vanhoja viikkoja voi katsella; ajanotto on käytössä vain kuluvalla viikolla.

Tehtävät, tauot ja työaika-asetukset tallennetaan selaimen IndexedDB-tietokantaan. Tietoja ei lähetetä verkkoon. Tietokanta on selain- ja alkuperäkohtainen, joten eri selaimissa tai eri osoitteissa tallennetut tiedot eivät ole yhteisiä.
