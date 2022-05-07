const express = require('express')
const fileUpload = require('express-fileupload')
const bodyParser = require('body-parser')
const csvParse = require('csv-parse')

const app = express()
const port = 3000

app.set("view engine", "pug")
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
// enable files upload
app.use(fileUpload({ createParentPath: true }))

app.get('/', (request, response) => {
    response.json({ info: 'Node.js, Express, and Postgres API' })
})
app.get('/new', (request, response) => {
    response.render("new-group-purchase")
})

app.post('/upload', (request, response) => {
    let purchaseFile;
    let uploadPath;
    if (!request.files || Object.keys(request.files).length === 0) {
        return response.status(400).send('No file uploaded')
    } else {
        const purchaseFile = request.files.purchaseFile
        const uploadPath = './uploads/' + purchaseFile.name
        purchaseFile.mv(uploadPath, function (err) {
            if (err)
                return response.status(500).send(err)
        })
        const parser = csvParse.parse({ delimiter: ',', columns: true, trim:true })
        const records = []
        parser.on('readable', () => {
            let record;
            while((record = parser.read()) !== null) {
                const purchaseItem = {
                    label: record.item,
                    unitPrice: Number.parseFloat(record.unitp),
                    quantity: Number.parseInt(record.qty),
                    buyer: record.buyer }
                records.push(purchaseItem)
            }
        })
        parser.on('error', (err) => {
            console.error(err.message)
        })
        parser.write(purchaseFile.data);
        parser.end()
        console.log(records)
        response.send('File uploaded')
    }
})

app.listen(port, () => {
    console.log(`App running on port ${port}.`)
})
