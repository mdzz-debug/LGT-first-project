import { shallowRef } from 'vue'

const recycleOpen = shallowRef(false)
const registrationOpen = shallowRef(false)

export const useModalHub = () => ({ recycleOpen, registrationOpen })
