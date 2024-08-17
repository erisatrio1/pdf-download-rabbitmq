
# Implementasi RabbitMQ dalam service pdf downloader

Project pdf download menggunakan RabbitMQ sebagai message broker.

Deskripsi project:
- serviceSatu adalah service yang berfungsi mengirimkan link yang akan di-pdf-kan dalam bentuk array of links melalui message broker kapada serviceDua. 
- serviceDua adalah service yang berfungsi menerima link yang akan di-pdf-kan dari serviceSatu melalui message broker. 




## Installation

Install depedencies dengan npm pada kedua service

```bash
  npm install
```
    
## Run Locally

Clone the project

```bash
  git clone https://github.com/erisatrio1/pdf-download-rabbitmq.git
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


## Authors

- [@erisatrio1](https://www.github.com/erisatrio1)


## Running Tests

To run tests, run the following command

```bash
  npm run test
```


## Usage/Examples

Buka Postman kemudian buatlah new request dengan method post ada endpoint: 

http://localhost:5000/send-pdf-links

Klik tab body pada Postman, ganti dropdown "none" menjadi "raw" kemudian isi dengan:

{
  "pdfLinks": [
    "https://github.com/erisatrio1"
  ]
}

kemudian serviceSatu melalui method post /send-pdf-links akan mengirimkan array of links ke serviceDua melalui message broker. 
serviceDua akan mencari halaman tersebut dengan puppeteer dan mendownload halaman html ke dalam bentuk pdf. 

Negative case:
Untuk mengetahui ketersediaan serviceDua, serviceSatu akan mengecek ketersediaan dengan hit endpoint http://localhost:5001/check 

Jika serviceDua mati maka serviceSatu akan mengirimkan status 503 pada user.

