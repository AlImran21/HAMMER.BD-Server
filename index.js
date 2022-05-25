const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hecqq.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {

        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }

        req.decoded = decoded;
        next();
    })
}


async function run() {

    try {
        await client.connect();
        const productsCollection = client.db('HAMMER').collection('products');
        const userCollection = client.db('HAMMER').collection('users');
        const bookingCollection = client.db('HAMMER').collection('bookings');
        const addProductCollection = client.db('HAMMER').collection('addProducts');


        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });

            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' });
            }
        }


        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });


        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        });


        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;

            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);

        });


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
            res.send({ result, token });
        });


        app.get('/product', async (req, res) => {
            const query = {};
            const cursor = productsCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });


        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await productsCollection.findOne(query);
            res.send(product)
        });


        app.get('/booking', verifyJWT, async (req, res) => {
            const visitor = req.query.visitor;
            const decodedEmail = req.decoded.email;

            if (visitor === decodedEmail) {
                const query = { visitor: visitor };
                const bookings = await bookingCollection.find(query).toArray();
                res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' });
            }

        });


        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { product: booking.product, date: booking.date, visitor: booking.visitor };
            const exists = await bookingCollection.findOne(query);

            if (exists) {
                return res.send({ success: false, booking: exists });
            }

            const result = await bookingCollection.insertOne(booking);
            res.send({ success: true, result });
        });


        app.get('/addProduct', verifyJWT, verifyAdmin, async (req, res) => {
            const addProducts = await addProductCollection.find().toArray();
            res.send(addProducts);
        });


        app.post('/addProduct', verifyJWT, verifyAdmin, async (req, res) => {
            const product = req.body;
            const result = await addProductCollection.insertOne(product);
            res.send(result);
        });



        app.delete('/addProduct/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await addProductCollection.deleteOne(filter);
            res.send(result);
        });


    }

    finally {

    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('Hello HAMMER.BD SERVER');
});

app.listen(port, () => {
    console.log('my-assignment-12-server-running', port);
});