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


            ws.send(JSON.stringify({
                op: "search",
                nonce: Date.now(),
                data: searchData
            }));

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


                try {
                    ws.close();
                } catch {}

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


    const {
        id,
        offset,
        internal_offset,
        before,
        sort,
        order,
        ...rest
    } = req.query;


    const searchData = {

        // Pagination
        offset: offset
            ? Number(offset)
            : 0,

        internal_offset: internal_offset
            ? Number(internal_offset)
            : 0,


        // Current Unix timestamp if not provided
        before: before
            ? Number(before)
            : Math.floor(Date.now() / 1000),


        // Search query
        query: String(id || ""),


        // Defaults
        sort: sort || "time",

        order: order || "ascending",


        // Pass through anything else
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

            internal_offset:
                searchData.internal_offset,

            before:
                searchData.before,

            sort:
                searchData.sort,

            order:
                searchData.order,

            count: items.length,

            items

        };


        cache.set(
            key,
            result
        );


        // Keep cache size limited
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

            sent: searchData,

            hint:
                "InfiniBrowser may have rejected the request"

        });

    }

}
