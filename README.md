
# Implementasi RabbitMQ dalam service pdf downloader

Project pdf download menggunakan RabbitMQ sebagai message broker, Minio sebagai storage, mongoDB untuk save logging, elasticsearch dan kibana.

Deskripsi project:
- serviceSatu adalah service yang berfungsi mengirimkan link yang akan di-pdf-kan dalam bentuk array of links melalui message broker kapada serviceDua. 
- serviceDua adalah service yang berfungsi menerima link yang akan di-pdf-kan dari serviceSatu melalui message broker. 

    
## Run Locally

Clone the project

```bash
  git clone https://github.com/erisatrio1/pdf-download-rabbitmq.git
```

Tambahkan .env file pada kedua service dengan detail:
serviceSatu

```bash
PORT=5000

SERVICE_DUA_URL='http://localhost:5001/check'

RABBIT_PORT='amqp://localhost'
```

serviceDua

```bash
PORT=5001

ELASTIC_PORT="http://localhost:9200"

MINIO_ENDPOINT='localhost'
MINIO_PORT=9000
MINIO_ACCESS_KEY='minioadmin'
MINIO_SECRET_KEY='minioadmin'

MONGODB_PORT='mongodb://127.0.0.1:27017/pdflogs'

RABBIT_PORT='amqp://localhost'
```

Go to the project directory

```bash
  cd serviceSatu
```

Install dependencies

```bash
  npm install
```

Start the server

```bash
  npm run dev
```

Lakukan hal yang sama pada serviceDua.


## Usage/Examples

Buka Postman kemudian buatlah new request dengan method post ada endpoint: 

http://localhost:5000/send-pdf-links

Klik tab body pada Postman, ganti dropdown "none" menjadi "raw" kemudian isi dengan:

{
  "pdfLinks": [
    "https://github.com/erisatrio1"
  ]
}

kemudian serviceSatu melalui method POST /send-pdf-links akan mengirimkan array of links ke serviceDua melalui message broker. 
serviceDua akan mencari halaman tersebut dengan puppeteer dan mendownload halaman html ke dalam bentuk pdf. 

Akses analytics untuk melihat rata-rata kecepatan donwload dan upload dalam 10 record terkhir dengan hit endpoint method POST:

http://localhost:5001/analytics

Negative case:
Untuk mengetahui ketersediaan serviceDua, serviceSatu akan mengecek ketersediaan dengan hit endpoint http://localhost:5001/check 

Jika serviceDua mati maka serviceSatu akan mengirimkan status 503 pada user.


## Authors

- [@erisatrio1](https://www.github.com/erisatrio1)

