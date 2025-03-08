import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const COINGECKO_API_URL = process.env.COINGECKO_API_URL;

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

let cache = { timestamp: null, data: null };

async function fetchTrending() {
	const now = new Date();
	if (cache.timestamp && now - cache.timestamp < 60000) {
		return cache.data;
	}

	const response = await fetch(`${COINGECKO_API_URL}/search/trending?x_cg_api_key=${process.env.COINGECKO_API_KEY}`);	  

	if (!response.ok) {
		throw new Error(`API call failed with status: ${response.status}`);
	}

	const data = await response.json();
	cache = { timestamp: now, data };
	return data;
}


// async function fetchCryptocurrencies() {
// 	const response = await fetch(
// 		`${cryptocompare_API_URL}/data/blockchain/list?api_key=${cryptocompare_API_KEY}`
// 	);
// 	if (!response.ok) {
// 		throw new Error(`API call failed with status: ${response.status}`);
// 	}
// 	const data = await response.json();
// 	return data;
// }

async function getCountry() {
	const response = await fetch("https://ipapi.co/json/");
	if (!response.ok) {
		throw new Error(`Country fetch failed with status: ${response.status}`);
	}
	return await response.json();
}

async function convertAllTrendingCoinsToPHP() {
	const ratesResponse = await fetch(
		"https://api.exchangerate-api.com/v4/latest/USD"
	);
	if (!ratesResponse.ok) {
		throw new Error(
			`Exchange rates API call failed with status: ${ratesResponse.status}`
		);
	}
	const ratesData = await ratesResponse.json();
	const phpRate = ratesData.rates.PHP;

	const trendingData = await fetchTrending();
	return trendingData.coins.map((coin) => {
		const rawPrice = String(coin.item.data.price || "0");
		let usdAmount = 0;

		const mainPriceMatch = rawPrice.match(
			/\$(\d+\.\d+)(?:<sub.*?title="([\d.]+)".*?>.*?<\/sub>)?(\d*)/
		);
		if (mainPriceMatch) {
			const mainPrice = parseFloat(mainPriceMatch[1]);
			const subTitleValue = mainPriceMatch[2]
				? parseFloat(mainPriceMatch[2])
				: 0;
			const subValue = mainPriceMatch[3]
				? parseFloat(`0.${mainPriceMatch[3]}`)
				: 0;
			usdAmount = mainPrice + subTitleValue + subValue;
		} else {
			usdAmount = parseFloat(rawPrice.replace(/[^\d.-]/g, ""));
		}

		const phpAmount = usdAmount * phpRate;
		return {
			name: coin.item.name,
			symbol: coin.item.symbol,
			priceInPHP: phpAmount,
		};
	});
}

app.get("/", async (req, res) => {
	try {
		const trendingCoins = await fetchTrending();
		const userCountry = await getCountry();
		const userBTCurrency = await convertAllTrendingCoinsToPHP();

		res.render("index", {
			trendingCoins,
			userCountry: userCountry.country_name,
			userBTCurrency,
			// cryptoCurrencies,
		});
	} catch (error) {
		console.error("Error:", error);
		res.status(500).send("Failed to fetch data");
	}
});

app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
