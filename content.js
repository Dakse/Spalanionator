var active = false;
function extractDecimalsAsStrings(input) {
  const regex = /\d+[.,]\d+/g;
  const matches = input.match(regex);
  return matches ? matches.map((m) => m.replace(",", ".")) : [];
}
async function getData() {
  try {
    if (active) return;
    active = true;
    let json = JSON.parse(
      document.querySelector("script[type='application/ld+json']").innerText
    );

    if (!json?.brand || !json?.model) {
      return;
    }
    const sidePanel = document.querySelector(
      "div[data-testid='ad-parameters-container']"
    );
    const loadingParam = createParam(`Ładowanie...`);
    sidePanel?.append(loadingParam);

    let headers = new Headers();

    headers.append("Content-Type", "application/json");
    headers.append("Accept", "application/json");

    headers.append("Origin", "http://localhost:3000");

    let data = await fetch(
      `https://vercel-functions-five-alpha.vercel.app/api/cars?make=${json.brand
        .toLowerCase()
        .replace(/[^\w ]/, "")}&model=${json.model
        .toLowerCase()
        .replace(/[^\w ]/, "")
        .replaceAll(" ", "-")}`,
      { headers: headers, cache: "force-cache" }
    )
      .then((r) => {
        return r.json();
      })
      .then((d) => d)
      .catch((e) => console.debug(e));
    let _params = document.querySelectorAll(
      "div[data-testid='ad-parameters-container'] p"
    );

    let params = [];

    _params.forEach((p) => {
      p && params.push(p.innerText || p.innerHTML);
    });

    var displacement = (
      parseInt(
        params
          .find((p) => p.includes("Poj. silnika"))
          ?.split(":")[1]
          .replace("cm³", "")
          .replaceAll(" ", "")
      ) / 1000
    ).toFixed(1);

    if (!displacement || displacement === "NaN") {
      let decimal = extractDecimalsAsStrings(json.name)?.[0];
      let decimalDesc = extractDecimalsAsStrings(json.description)?.[0];
      if (decimal || decimalDesc) {
        console.debug(
          decimal,
          "Extracted displacement from ad - might not match"
        );
        displacement = decimal || decimalDesc;
      }
    }

    const power = params
      .find((p) => p.includes("Moc silnika"))
      ?.split(":")[1]
      .replaceAll(" ", "");
    const year = json.productionDate;
    const _fuel = params
      .find((p) => p.includes("Paliwo"))
      ?.split(":")[1]
      .replaceAll(" ", "");

    const fuel =
      _fuel === "Diesel"
        ? "on"
        : _fuel === "Benzyna"
        ? "pb"
        : _fuel === "LPG"
        ? "lpg"
        : "other";

    function getEngine(
      { data, power, year, displacement },
      { checkFrom, checkTo, checkDisplacement, checkPower, checkFuelType }
    ) {
      let flatArr = Object.values(data).flat();
      let engine = flatArr.find((item) => {
        const check =
          (checkFrom ? year >= item.from : true) &&
          (checkTo ? year <= (item.to || Infinity) : true) &&
          (checkDisplacement
            ? displacement
              ? item.engineName.startsWith(displacement)
              : true
            : true) &&
          (checkPower
            ? power
              ? item.engineName.includes(power)
              : true
            : true) &&
          (checkFuelType ? item.fuelType === fuel : true);
        // console.debug(displacement, fuel, item.engineName, item.fuelType);
        return check;
      });
      if (engine) {
        console.debug("Engine found!");
        return {
          ...engine,
          fuelChanged: Boolean(
            !checkFuelType && engine === "lpg" && engine.fuelType === "pb"
          ),
        };
      } else {
        return null;
      }
    }
    console.debug("Searching for engine");
    var engine = getEngine(
      { data, power, year, displacement },
      {
        checkFrom: true,
        checkTo: true,
        checkDisplacement: true,
        checkPower: true,
        checkFuelType: true,
      }
    );
    if (!engine) {
      console.debug("Disabling power check");
      engine = getEngine(
        { data, power, year, displacement },
        {
          checkFrom: true,
          checkTo: true,
          checkDisplacement: true,
          checkPower: false,
          checkFuelType: true,
        }
      );
    }
    if (!engine) {
      console.debug("Checking older generations");
      engine = getEngine(
        { data, power, year, displacement },
        {
          checkFrom: true,
          checkTo: false,
          checkDisplacement: true,
          checkPower: false,
          checkFuelType: true,
        }
      );
    }

    if (!engine) {
      console.debug("Disabling fuel type check");
      engine = getEngine(
        { data, power, year, displacement },
        {
          checkFrom: true,
          checkTo: false,
          checkDisplacement: true,
          checkPower: false,
          checkFuelType: false,
        }
      );
    }
    if (!engine) {
      console.debug("Disabling year check");
      engine = getEngine(
        { data, power, year, displacement },
        {
          checkFrom: false,
          checkTo: false,
          checkDisplacement: true,
          checkPower: false,
          checkFuelType: false,
        }
      );
    }

    function createParam(text) {
      var loader = document.createElement("p");
      loader.classList.add("css-1los5bp");
      loader.style.border = "3px solid teal";

      loader.innerHTML = `${text}`;
      return loader;
    }

    const engineParam = createParam(`Silnik: <b>${engine?.engineName}</b>`);
    const fuelParam = createParam(
      `Spalanie: <b>${engine?.fuelConsumption} ${
        engine?.fuelChanged ? "(Benzyna)" : ""
      }L</b> / 100km`
    );
    const costParam = createParam(
      `Koszt przejechania 100km: <b>${engine?.fuelCost}</b>`
    );
    const notFoundParam = createParam(`Nie znaleziono danych silnika :(`);
    setTimeout(() => {
      loadingParam.remove();
      if (engine) {
        sidePanel.append(engineParam);
        sidePanel.append(fuelParam);
        sidePanel.append(costParam);
      } else {
        sidePanel.append(notFoundParam);
      }
    }, 0);
  } catch (error) {
    console.debug(error);
    active = false;
  } finally {
    active = false;
  }
}
window?.navigation.addEventListener("navigate", (event) => {
  if (event.destination.url.includes("https://www.olx.pl/d/oferta")) {
    setTimeout(() => getData(), 500);
  }
});

if (window.location.href.includes("https://www.olx.pl/d/oferta")) {
  getData();
}
