import WebSocket from "ws";

const cache = new Map();

function connectInfini(searchData) {
    return new Promise((resolve, reject) => {

        let finished = false;

        let ws;

        const timeout = setTimeout(() => {
            if (!finished) {
                finished = true;

                try {
                    ws?.close();
                } catch {}

                reject(new Error("InfiniBrowser timeout"));
            }
        }, 15000);


        ws = new WebSocket(
            "wss://infinibrowser.wiki/api/ws",
            {
                headers: {
                    Origin: "https://infinibrowser.wiki",
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                }
            }
        );


        ws.on("open", () => {

            ws.send(JSON.stringify({
                op: "identify",
                data: {
                    client: "InfiniBrowser/1.6",
                    version: 2,
                    token: null
                }
            }));


            setTimeout(() => {

                // searchData is spread as-is so every query param the caller
                // sent (offset, internal_offset, sort, order, query, and any
                // future ones) passes straight through to InfiniBrowser.
                ws.send(JSON.stringify({
                    op: "search",
                    nonce: 1,
                    data: searchData
                }));

            }, 500);

        });



        ws.on("message", raw => {

            let msg;

            try {
                msg = JSON.parse(raw.toString());
            } catch {
                return;
            }


            if (msg.op === "search" && !finished) {

                finished = true;

                clearTimeout(timeout);

                resolve(
                    msg.data?.items || []
                );

                ws.close();
            }

        });



        ws.on("unexpected-response", (req, res) => {

            if (!finished) {

                finished = true;

                clearTimeout(timeout);

                reject(
                    new Error(
                        "WebSocket rejected: " + res.statusCode
                    )
                );

            }

        });



        ws.on("error", err => {

            if (!finished) {

                finished = true;

                clearTimeout(timeout);

                reject(err);

            }

        });



        ws.on("close", () => {

            if (!finished) {

                finished = true;

                clearTimeout(timeout);

                reject(
                    new Error("Connection closed")
                );

            }

        });

    });
}



export default async function handler(req, res) {

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );


    // Pull out the fields we give defaults to, and keep everything else
    // in `rest` so any other param the client sends (present or future)
    // still reaches InfiniBrowser untouched.
    const {
        id,
        offset,
        internal_offset,
        sort,
        order,
        ...rest
    } = req.query;


    const searchData = {
        query: String(id || ""),
        offset: Number(offset) || 0,
        internal_offset: Number(internal_offset) || 0,
        sort: sort || "time",
        order: order || "ascending",
        ...rest
    };


    const key = JSON.stringify(searchData);


    if (cache.has(key)) {

        return res.json(
            cache.get(key)
        );

    }


    try {

        const items = await connectInfini(searchData);


        const result = {
            query: searchData.query,
            offset: searchData.offset,
            count: items.length,
            items
        };


        cache.set(
            key,
            result
        );


        if (cache.size > 1000) {

            cache.delete(
                cache.keys().next().value
            );

        }


        return res.json(result);


    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: err.message,
            hint:
            "InfiniBrowser may be blocking server-side websocket clients"
        });

    }

}
