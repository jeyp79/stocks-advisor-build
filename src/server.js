import express from 'express';
//import bodyParser from 'body-parser';
import { MongoClient } from 'mongodb';
import path from 'path';

const app = express();
app.use(express.static(path.join(__dirname, '/build')));

//Allow to parse JSON
app.use(express.json());

//Function to operate with the database
const withDB = async (operations, res) => {
    try {
        const client = await MongoClient.connect('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true });
        const db = client.db('stocks-screener');
    
        await operations(db);
    
        client.close();
    } catch (error) {
        res.status(500).json({ message: 'Error connecting to db', error });
    }
}

//Get personal information about the stock, such as the notes I did and is it favorite company
app.get('/api/stock/:symbol', async (req, res) => {
    withDB(async (db) => {

        const stockSymbol = req.params.symbol;

        const listOfStocks = await db.collection('stocks').findOne({ Symbol : stockSymbol })
        res.status(200).json(listOfStocks);        
    }, res);
});


//Switch between favorite/not favorite company
app.post('/api/stock/:symbol/favorite', async (req, res) => {
    withDB(async (db) => {

        const stockSymbol = req.params.symbol;

    
        const listOfStocks = await db.collection('stocks').findOne({ Symbol : stockSymbol });
        await db.collection('stocks').updateOne({ Symbol : stockSymbol }, {
            '$set': {
                favorite: listOfStocks.favorite * (-1),
            },
        });
        const updatedlistOfStocks = await db.collection('stocks').findOne({ Symbol : stockSymbol });
    
        res.status(200).json(updatedlistOfStocks);
     
    }, res);        
});

//Personal notes on stock pages
app.post('/api/stock/:symbol/add-comment', (req, res) => {
    const { username, myText } = req.body;
    const stockSymbol = req.params.symbol;

    withDB(async (db) => {
        const stockInfo = await db.collection('stocks').findOne({ Symbol : stockSymbol });
        await db.collection('stocks').updateOne({ Symbol : stockSymbol }, {
            '$set': {
                myNotes: stockInfo.myNotes.concat({ username, myText }),
            },
        });
        const updatedStockInfo = await db.collection('stocks').findOne({ Symbol : stockSymbol });

        res.status(200).json(updatedStockInfo);
    }, res);
});

//Find the list of stocks according to radio buttons selection
app.get('/api/Stocks-List/:type', async (req, res) => {

    const listType = req.params.type;

    switch(listType) {
        case 'My favorites': return (
            withDB(async (db) => {
                const listOfStocks = await db.collection('stocks')
                    .find({
                        favorite: { $eq: 1 },
                    })
                    .sort({ points : -1, favorite : -1, Symbol : 1}).toArray()
                res.status(200).json(listOfStocks);        
            }, res)
        )
        case 'Top companies': return(
            withDB(async (db) => {
                const listOfStocks = await db.collection('stocks')
                    .find({
                        points: { $gte: 14 },
                    })
                    .sort({ points : -1, favorite : -1, Symbol : 1}).toArray()
                res.status(200).json(listOfStocks);        
            }, res)
        )
        case 'Above average': return(
            withDB(async (db) => {
                const listOfStocks = await db.collection('stocks')
                    .find({
                        points: { $gte: 11 },
                    })
                    .sort({ points : -1, favorite : -1, Symbol : 1}).toArray()
                res.status(200).json(listOfStocks);        
            }, res)
        )
        case 'Full list': return(
            withDB(async (db) => {
                const listOfStocks = await db.collection('stocks')
                    .find()
                    .sort({ points : -1, favorite : -1, Symbol : 1}).toArray()
                res.status(200).json(listOfStocks);        
            }, res)
        )
        default: return (
            withDB(async (db) => {
                const listOfStocks = await db.collection('stocks')
                    .find({
                        points: { $gte: 14 },
                    })
                    .sort({ points : -1, favorite : -1, Symbol : 1}).toArray()
                res.status(200).json(listOfStocks);        
            }, res)
        )          
    }    
});

//New company insert or update of existed
app.post('/api/stock/:symbol/add-stock', (req, res) => {

    let myObj = req.body;
    const stockSymbol = req.params.symbol;

    let points = 0;
    //const maxPoints = 16;

    //Test companies fundamentals and sum quality points
    if(parseInt(myObj.MarketCapitalization, 10) > 2000000000) { points++; }
    if(parseFloat(myObj.PERatio) > 8 && parseFloat(myObj.PERatio) < 40) { points++; }
    if(parseFloat(myObj.PEGRatio) > 0 && parseFloat(myObj.PEGRatio) < 4) { points++; }
    if(parseFloat(myObj.EVToRevenue) > 0 && parseFloat(myObj.EVToRevenue) < 4) { points++; }
    if(parseFloat(myObj.EPS) > 0) { points++; }
    if(parseFloat(myObj.QuarterlyEarningsGrowthYOY) > 0) { points++; }
    if(parseFloat(myObj.QuarterlyRevenueGrowthYOY) > 0) { points++; }
    if(parseFloat(myObj.ProfitMargin) >= 0.1) { points++; }
    if(parseFloat(myObj.ReturnOnAssetsTTM) >= 0.04) { points++; }
    if(parseFloat(myObj.ReturnOnEquityTTM) >= 0.04) { points++; }
    if(parseFloat(myObj.PriceToSalesRatioTTM) > 0 && parseFloat(myObj.PriceToSalesRatioTTM) < 3) { points++; }
    if(parseFloat(myObj.PriceToBookRatio) > 0 && parseFloat(myObj.PriceToBookRatio) < 4) { points++; }
    if(parseFloat(myObj.Beta) > -2 && parseFloat(myObj.Beta) < 2) { points++; }
    if(parseFloat(myObj.PercentInsiders) > 1 && parseFloat(myObj.PercentInsiders) < 70) { points++; }
    if(parseFloat(myObj.PercentInstitutions) > 5) { points++; }
    if(parseFloat(myObj.PayoutRatio) < 0.5) { points++; }
    

    withDB(async (db) => {
        
        await db.collection('stocks').updateOne({ Symbol : stockSymbol }, {
            $set: 
            {
                Symbol : myObj.Symbol, 
                AssetType : myObj.AssetType, 
                Name : myObj.Name, 
                Description : myObj.Description, 
                Exchange : myObj.Exchange, 
                Currency : myObj.Currency, 
                Country : myObj.Country, 
                Sector : myObj.Sector, 
                Industry : myObj.Industry, 
                Address : myObj.Address, 
                FullTimeEmployees : myObj.FullTimeEmployees, 
                FiscalYearEnd : myObj.FiscalYearEnd, 
                LatestQuarter : myObj.LatestQuarter, 
                MarketCapitalization : parseInt(myObj.MarketCapitalization, 10), 
                EBITDA : myObj.EBITDA, 
                PERatio : parseFloat(myObj.PERatio), 
                PEGRatio : parseFloat(myObj.PEGRatio), 
                BookValue : myObj.BookValue, 
                DividendPerShare : myObj.DividendPerShare, 
                DividendYield : myObj.DividendYield, 
                EPS : parseFloat(myObj.EPS), 
                RevenuePerShareTTM : myObj.RevenuePerShareTTM, 
                ProfitMargin : parseFloat(myObj.ProfitMargin), 
                OperatingMarginTTM : myObj.OperatingMarginTTM, 
                ReturnOnAssetsTTM : parseFloat(myObj.ReturnOnAssetsTTM), 
                ReturnOnEquityTTM : parseFloat(myObj.ReturnOnEquityTTM), 
                RevenueTTM : myObj.RevenueTTM, 
                GrossProfitTTM : myObj.GrossProfitTTM, 
                DilutedEPSTTM : myObj.DilutedEPSTTM, 
                QuarterlyEarningsGrowthYOY : parseFloat(myObj.QuarterlyEarningsGrowthYOY), 
                QuarterlyRevenueGrowthYOY : parseFloat(myObj.QuarterlyRevenueGrowthYOY), 
                AnalystTargetPrice : myObj.AnalystTargetPrice, 
                TrailingPE : myObj.TrailingPE, 
                ForwardPE : myObj.ForwardPE, 
                PriceToSalesRatioTTM : parseFloat(myObj.PriceToSalesRatioTTM), 
                PriceToBookRatio : parseFloat(myObj.PriceToBookRatio), 
                EVToRevenue : parseFloat(myObj.EVToRevenue), 
                EVToEBITDA : myObj.EVToEBITDA, 
                Beta : parseFloat(myObj.Beta), 
                SharesOutstanding : myObj.SharesOutstanding, 
                SharesFloat : myObj.SharesFloat, 
                SharesShort : myObj.SharesShort, 
                SharesShortPriorMonth : myObj.SharesShortPriorMonth, 
                ShortRatio : myObj.ShortRatio, 
                ShortPercentOutstanding : myObj.ShortPercentOutstanding, 
                ShortPercentFloat : myObj.ShortPercentFloat, 
                PercentInsiders : parseFloat(myObj.PercentInsiders), 
                PercentInstitutions : parseFloat(myObj.PercentInstitutions), 
                ForwardAnnualDividendRate : myObj.ForwardAnnualDividendRate, 
                ForwardAnnualDividendYield : myObj.ForwardAnnualDividendYield, 
                PayoutRatio : parseFloat(myObj.PayoutRatio), 
                DividendDate : myObj.DividendDate, 
                ExDividendDate : myObj.ExDividendDate, 
                LastSplitFactor : myObj.LastSplitFactor, 
                LastSplitDate : myObj.LastSplitDate, 
                points : points,
            }, 
            $setOnInsert: {
                favorite : -1,                
                myNotes : []
            }
        }, {upsert: true});

        const updatedStockInfo = await db.collection('stocks').findOne({ Symbol : stockSymbol });

        res.status(200).json(updatedStockInfo);
    }, res);
});


app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname + '/build/index.html'));
});

//Start the server
app.listen(8000, () => console.log('Listening on port 8000'));