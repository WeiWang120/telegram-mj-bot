import _ from "lodash"

export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
