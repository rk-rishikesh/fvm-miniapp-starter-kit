"use client";
import React, { useEffect, useState } from "react";
import {
  Section,
  Cell,
  Image,
  List,
  Placeholder,
  FileInput,
} from "@telegram-apps/telegram-ui";
import { Link } from "@/components/Link/Link";
// Date Prep Helpers
import { CarWriter } from "@ipld/car";
import { importer } from "ipfs-unixfs-importer";
import browserReadableStreamToIt from "browser-readablestream-to-it";
import { CommP } from "@web3-storage/data-segment";

async function readFileAsUint8Array(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const arrayBuffer = reader.result;
      if (arrayBuffer != null) {
        if (typeof arrayBuffer === "string") {
          const uint8Array = new TextEncoder().encode(arrayBuffer);
          resolve(uint8Array);
        } else if (arrayBuffer instanceof ArrayBuffer) {
          const uint8Array = new Uint8Array(arrayBuffer);
          resolve(uint8Array);
        }
        return;
      }
      reject(new Error("arrayBuffer is null"));
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsArrayBuffer(file);
  });
}

const generateCommP = async (bytes, setPieceSize, setPieceCID) => {
  const commP = await CommP.build(bytes);
  const pieceSize = commP.pieceSize;
  setPieceSize(pieceSize);
  // Gives you a commP as a CID
  const cid = commP.link();
  setPieceCID(cid.toString());
};

function CarGeneratorLink({
  files,
  className,
  children,
  setRootCid,
  rootCid,
  setCarSize,
  setPieceSize,
  setPieceCID,
}) {
  const [carUrl, setCarUrl] = useState();

  useEffect(() => {
    async function fetchData() {
      if (!files || files.length === 0) return;
      const { root, car } = await createCarBlob(files);
      if (car) {
        console.log(car);
        setCarSize(car.size);
        setCarUrl(URL.createObjectURL(car));
        setRootCid(root);
      }
      await generateCommP(
        await readFileAsUint8Array(files[0]),
        setPieceSize,
        setPieceCID
      );
    }
    fetchData();
  }, [files]);

  return carUrl ? (
    <a href={carUrl} download className="z-99">
      {children}
    </a>
  ) : null;
}

function FileForm({ files = [], setFiles }) {
  return (
    <form style={{ opacity: files.length ? 0.8 : 1 }}>
      {files.length ? null : (
        <label className="db mh2 mh0-ns pv3 link pointer glow o-90 bg-blue white relative br1">
          <List
            style={{
              background: "var(--tgui--secondary_bg_color)",
              padding: 10,
            }}
          >
            <Section>
              <Cell
                // before={<Icon32ProfileColoredSquare />}
                subtitle="Data prep for deal making made easy."
              >
                Upload your data
              </Cell>
              <FileInput onChange={onFileInput.bind(null, setFiles)} />
            </Section>
          </List>
        </label>
      )}
    </form>
  );
}

function onFileInput(setFiles, evt) {
  evt.preventDefault();
  evt.stopPropagation();
  const fileList = evt && evt.target && evt.target.files;
  const files = [];
  for (const file of fileList) {
    files.push(file);
  }
  setFiles(files);
}

async function createCarBlob(files) {
  if (!files || !files.length) return;
  if (files.car) return;
  const carParts = [];
  const { root, out } = await fileListToCarIterator(files);
  for await (const chunk of out) {
    carParts.push(chunk);
  }
  const car = new Blob(carParts, {
    type: "application/car",
  });
  return { root, car };
}

class MapBlockStore {
  constructor() {
    this.store = new Map();
  }
  *blocks() {
    for (const [cid, bytes] of this.store.entries()) {
      yield { cid, bytes };
    }
  }
  put({ cid, bytes }) {
    return Promise.resolve(this.store.set(cid, bytes));
  }
  get(cid) {
    return Promise.resolve(this.store.get(cid));
  }
}

export async function fileListToCarIterator(
  fileList,
  blockApi = new MapBlockStore()
) {
  const fileEntries = [];
  for (const file of fileList) {
    fileEntries.push({
      path: file.name,
      content: browserReadableStreamToIt(file.stream()),
    });
  }

  const options = {
    cidVersion: 1,
    wrapWithDirectory: true,
    rawLeaves: true,
  };
  const unixFsEntries = [];
  for await (const entry of importer(fileEntries, blockApi, options)) {
    unixFsEntries.push(entry);
  }

  const root = unixFsEntries[unixFsEntries.length - 1].cid;
  const { writer, out } = CarWriter.create(root);
  for (const block of blockApi.blocks()) {
    writer.put(block);
  }
  writer.close();
  console.log(root.toString());
  console.log(out);
  return { root, out };
}

export default function Home() {
  // States
  const [files, setFiles] = useState([]);
  const [rootCid, setRootCid] = useState();
  const [carSize, setCarSize] = useState();
  const [pieceSize, setPieceSize] = useState();
  const [pieceCID, setPieceCID] = useState();

  // Functions

  return (
    <div>
      <div className="HIJtihMA8FHczS02iWF5">
        <Placeholder
          description="Data prep for deal making made easy"
          header="F &nbsp;I &nbsp;L &nbsp;&nbsp;&nbsp;&nbsp;B &nbsp;U &nbsp;I &nbsp;L &nbsp;D &nbsp;E &nbsp;R &nbsp;S "
        >
          <Image src="/logo.png" style={{ backgroundColor: "#007AFF" }} />
        </Placeholder>
      </div>

      <FileForm files={files} setFiles={setFiles} />

      <List>
        {files && files.length ? (
          <Section header="File Details" footer="">
            <Cell subtitle={rootCid ? rootCid.toString() : "..."}>
              IPFS CID
            </Cell>

            <Cell subtitle={carSize ? carSize : "..."}>CAR SIZE</Cell>

            <Cell subtitle={pieceSize ? pieceSize : "..."}>PIECE SIZE</Cell>

            <Cell subtitle={pieceCID ? pieceCID : "..."}>PIECE CID</Cell>
          </Section>
        ) : null}
        <CarGeneratorLink
          files={files}
          rootCid={rootCid}
          setRootCid={setRootCid}
          setCarSize={setCarSize}
          setPieceSize={setPieceSize}
          setPieceCID={setPieceCID}
          className="db mt4 pa3 mw5 center white link bg-blue f5 fw6 br1"
        >
        </CarGeneratorLink>
      </List>
    </div>
  );
}
