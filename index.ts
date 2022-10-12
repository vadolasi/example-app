import express from "express"
import helmet from "helmet"
import argon2 from "argon2"
import cookieSession from "cookie-session"
import multer from "multer"
import { body, validationResult } from "express-validator"
import { PrismaClient, Prisma, Usuario, ONG, Pet } from "@prisma/client"
import path from "path"

const prisma = new PrismaClient()

const app = express()
app.use(express.static("public"))
app.use(express.static("uploads"))
app.use(express.urlencoded())
app.use(helmet({ contentSecurityPolicy: false }))
app.set("view engine", "ejs")

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/")
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
})

const upload = multer({ storage })

const cookieSessionOptions: CookieSessionInterfaces.CookieSessionOptions = {
  name: "session",
  keys: ["GlsN5DXiYc"],
  httpOnly: false,
  maxAge: 24 * 60 * 60 * 1000 // 24 horas
}

app.use(cookieSession(cookieSessionOptions))

function spliceIntoChunks(arr: any[], chunkSize: number) {
  const res = []

  while (arr.length > 0) {
    const chunk = arr.splice(0, chunkSize)
    res.push(chunk)
  }

  return res
}

app.get("/", async (req, res) => {
  const pets = await prisma.pet.findMany({ take: 12 })

  // @ts-ignore
  res.render("index", { pets: spliceIntoChunks(pets, 3), usuario: req.session.usuario })
})

app.get("/pets", async (req, res) => {
  const pagina = Number(req.query.pagina || 1)
  const resultadosPorPagina = Number(req.query.resultadosPorPagina || 10)

  let numeroDePáginas = await prisma.pet.count() / resultadosPorPagina
  if (numeroDePáginas < resultadosPorPagina) {
    numeroDePáginas = 1
  }

  const pets = await prisma.pet.findMany({
    skip: pagina - 1 * numeroDePáginas,
    take: numeroDePáginas
  })

  // @ts-ignore
  res.render("pets", { pagina, resultadosPorPagina, numeroDePáginas, pets, usuario: req.session.usuario })
})

app.get("/pets/:petId/deletar", async (req, res) => {
  try {
    // @ts-ignore
    await prisma.pet.deleteMany({ where: { id: Number(req.params.petId), ongId: req.session.usuario.id } })
  } catch {}

  res.redirect("/meus_pets")
})

app.get("/pets/:petId/editar", async (req, res) => {
  // @ts-ignore
  const pet = await prisma.pet.findFirst({ where: { id: Number(req.params.petId), ongId: req.session.usuario.id } })
  // @ts-ignore
  res.render("editar_pet", { pet, usuario: req.session.usuario })
})

app.post(
  "/pets/:petId/editar",
  body("nome")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .trim()
    .escape(),
  body("sexo")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .isEmail()
    .withMessage("Email inválido")
    .normalizeEmail(),
  body("espécie")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .trim()
    .escape(),
    body("raça")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .trim()
    .escape(),
  async (req, res) => {
  try {
      // @ts-ignore
      await prisma.pet.updateMany({ where: { id: Number(req.params.id), ongId: req.session.usuario.id } })
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError) {
        // @ts-ignore
        return res.status(500).render("editar_pet", { erro: erro.message, usuario: req.session.usuario })
      } else {
        // @ts-ignore
        return res.status(500).render("editar_pet", { erro: "Ocorre um erro!", usuario: req.session.usuario })
      }
    }

    res.redirect("/meus_pets")
  }
)

// @ts-ignore
app.get("/quem_somos", (req, res) => res.render("quem_somos", { usuario: req.session.usuario }))

// @ts-ignore
app.get("/cadastro", (req, res) => res.render("cadastro", { usuario: req.session.usuario }))

app.post(
  "/cadastro",
  body("nome")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .trim()
    .escape(),
  body("email")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .isEmail()
    .withMessage("Email inválido")
    .normalizeEmail(),
  body("senha")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .isLength({ min: 5 })
    .withMessage("Senha muito curta")
    .matches(/\d/)
    .withMessage("A senha precisa conter um número")
    .trim()
    .escape(),
  body("confirmarSenha")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .custom((value, { req }) => {
      if (value == req.body.senha) {
        return true
      }

      throw new Error("As senhas precisam ser iguais")
    })
    .trim()
    .escape(),
  async (req, res) => {
    const erros = validationResult(req)

    if (!erros.isEmpty()) {
      // @ts-ignore
      return res.status(400).render("cadastro", { erros: erros.array(), usuario: req.session.usuario })
    }

    const { nome, email, senha } = req.body

    const senhaCriptografada = await argon2.hash(senha)

    try {
      await prisma.usuario.create({ data: { nome, email, senha: senhaCriptografada } })
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError) {
        if (erro.code == "P2002") {
          // @ts-ignore
          return res.status(500).render("cadastro", { erro: "Este email já está sendo utilizado!", usuario: req.session.usuario })
        } else {
          // @ts-ignore
          return res.status(500).render("cadastro", { erro: erro.message, usuario: req.session.usuario })
        }
      } else {
        // @ts-ignore
        return res.status(500).render("cadastro", { erro: "Ocorre um erro!", usuario: req.session.usuario })
      }
    }

    res.redirect("/login")
  }
)

// @ts-ignore
app.get("/login", (req, res) => res.render("login", { usuario: req.session.usuario }))

app.post("/login", async (req, res) => {
  const { email, senha, tipo } = req.body

  let usuario: Usuario | ONG | null

  if (tipo == "usuario") {
    usuario = await prisma.usuario.findUnique({ where: { email } })
  } else {
    usuario = await prisma.oNG.findUnique({ where: { email } })
  }

  if (!usuario) {
    // @ts-ignore
    return res.status(401).render("login", { erro: "Usuário não encontrado!", usuario: req.session.usuario })
  }

  const senhaCorreta = await argon2.verify(usuario.senha, senha)

  if (senhaCorreta) {
    // @ts-ignore
    req.session.usuario = { tipo, id: usuario.id, nome: usuario.nome }
    if (tipo == "usuario") {
      return res.redirect("/")
    } else {
      return res.redirect("/meus_pets")
    }
  } else {
    // @ts-ignore
    return res.status(401).render("login", { erro: "Senha incorreta!", usuario: req.session.usuario })
  }
})

app.get("/logout", (req, res) => {
  // @ts-ignore
  req.session.usuario = {}
  res.redirect("/login")
})

// @ts-ignore
app.get("/quem_somos", (req, res) => res.render("quem_somos", { usuario: req.session.usuario }))

// @ts-ignore
app.get("/cadastro_pet", (req, res) => res.render("cadastro_pet", { usuario: req.session.usuario }))

app.post(
  "/cadastro_pet",
  body("nome")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .trim()
    .escape(),
  body("sexo")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .isEmail()
    .withMessage("Email inválido")
    .normalizeEmail(),
  body("espécie")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .trim()
    .escape(),
    body("raça")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .trim()
    .escape(),
  upload.single("foto"),
  async (req, res) => {
    const {
      nome,
      especie,
      raca,
      sexo
    } = req.body

    try {
      await prisma.pet.create({ data: {
        nome,
        especie,
        raca,
        sexo,
        foto: "/" + req.file?.filename!,
        // @ts-ignore
        ongId: req.session.usuario.id
      }})
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError) {
        // @ts-ignore
        return res.status(500).render("cadastro_pet", { erro: erro.message, usuario: req.session.usuario })
      } else {
        // @ts-ignore
        return res.status(500).render("cadastro_pet", { erro: String(erro), usuario: req.session.usuario })
      }
    }

    // @ts-ignore
    res.redirect("/meus_pets")
  }
)

// @ts-ignore
app.get("/cadastro_ong", (req, res) => res.render("cadastro_ong", { usuario: req.session.usuario }))

app.get("/meus_pets", async (req, res) => {
  // @ts-ignore
  const pagina = Number(req.query.pagina || 1)
  const resultadosPorPagina = Number(req.query.resultadosPorPagina || 10)

  // @ts-ignore
  const ongId = req.session.usuario.id

  const quantidadeDePets = await prisma.pet.count({ where: { ongId } })

  let numeroDePáginas: number

  if (quantidadeDePets < resultadosPorPagina) {
    numeroDePáginas = 1
  } else {
    numeroDePáginas = Math.ceil(quantidadeDePets / resultadosPorPagina)
  }

  let pets: Pet[]

  if (req.query.cursor) {
    pets = await prisma.pet.findMany({
      cursor: {
        id: Number(req.query.cursor)
      },
      skip: 1,
      take: resultadosPorPagina,
      where: { ongId }
    })
  } else {
    pets = await prisma.pet.findMany({
      skip: (pagina - 1) * numeroDePáginas,
      take: resultadosPorPagina,
      where: { ongId }
    })
  }

  res.render("pets_ong", {
    pets,
    pagina,
    numeroDePáginas,
    // @ts-ignore
    usuario: req.session.usuario,
    cursor: pets.length > 0 ? pets[pets.length - 1].id : undefined
  })
})

app.post(
  "/cadastro_ong",
  body("nome")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .trim()
    .escape(),
  body("cnpj")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .trim()
    .escape(),
  body("email")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .isEmail()
    .withMessage("Email inválido")
    .normalizeEmail(),
  body("telefone")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .trim()
    .escape(),
  body("instagram")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .trim()
    .escape(),
  body("cep")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .trim()
    .escape(),
  body("atuaEmGrandeNatal")
    .toBoolean(),
  body("trabalhaComCaes")
    .toBoolean(),
  body("trabalhaComGatos")
    .toBoolean(),
  body("trabalhaComOutros")
    .toBoolean(),
  body("senha")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .isLength({ min: 5 })
    .withMessage("Senha muito curta")
    .matches(/\d/)
    .withMessage("A senha precisa conter um número")
    .trim()
    .escape(),
  body("confirmarSenha")
    .notEmpty()
    .withMessage("Este campo é obrigatório")
    .custom((value, { req }) => {
      if (value == req.body.senha) {
        return true
      }

      throw new Error("As senhas precisam ser iguais")
    })
    .trim()
    .escape(),
  async (req, res) => {
    const erros = validationResult(req)

    if (!erros.isEmpty()) {
      // @ts-ignore
      return res.status(400).render("cadastro_ong", { erros: erros.array(), usuario: req.session.usuario })
    }

    const {
      nome,
      email,
      cnpj,
      telefone,
      instagram,
      cep,
      atuaEmGrandeNatal,
      trabalhaComCaes,
      trabalhaComGatos,
      trabalhaComOutros,
      senha
    } = req.body

    const senhaCriptografada = await argon2.hash(senha)

    try {
      await prisma.oNG.create({ data: {
        nome,
        email,
        cnpj,
        telefone,
        instagram,
        cep,
        atuaEmGrandeNatal,
        trabalhaComCaes,
        trabalhaComGatos,
        trabalhaComOutros,
        senha: senhaCriptografada
      }})
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError) {
        if (erro.code == "P2002") {
          // @ts-ignore
          return res.status(500).render("cadastro_ong", { erro: "Este email já está sendo utilizado!", usuario: req.session.usuario })
        } else {
          // @ts-ignore
          return res.status(500).render("cadastro_ong", { erro: erro.message, usuario: req.session.usuario })
        }
      } else {
        // @ts-ignore
        return res.status(500).render("cadastro_ong", { erro: "Ocurreu um erro!", usuario: req.session.usuario })
      }
    }

    res.redirect("/login")
  }
)

const port = 8000

app.listen(port, () => console.log(`Site rodando em http://localhost:${port}`))
