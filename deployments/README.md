# Deployment records

`npm run deploy:local` or `npm run deploy:testnet` writes `current.json`, the website public deployment file, and the independent browser client config. These files contain only public addresses, chain IDs and interfaces. They are ignored so local addresses are never mistaken for a public deployment. No Robinhood testnet deployment is claimed until its receipts and deployed bytecode have been checked.
